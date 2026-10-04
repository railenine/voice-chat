import assert from 'node:assert';
import test, { describe, it, before, after } from 'node:test';
import { WebSocket } from 'ws';
import { server } from '../../server/index.js';

class TestWsClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.messages = [];
    this.waiters = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => resolve(this));
      this.ws.on('error', (err) => reject(err));
      this.ws.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          this.messages.push(parsed);

          // Check if any waiter matches this message
          for (let i = this.waiters.length - 1; i >= 0; i--) {
            const { predicate, resolve } = this.waiters[i];
            if (predicate(parsed)) {
              this.waiters.splice(i, 1);
              resolve(parsed);
            }
          }
        } catch (e) {}
      });
    });
  }

  send(msg) {
    if (typeof msg === 'string') {
      this.ws.send(msg);
    } else {
      this.ws.send(JSON.stringify(msg));
    }
  }

  async waitFor(predicate, timeoutMs = 3000) {
    // Check if already received
    const existing = this.messages.find(predicate);
    if (existing) return existing;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error(`Timeout waiting for message matching predicate after ${timeoutMs}ms`));
      }, timeoutMs);

      this.waiters.push({
        predicate,
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
    });
  }

  close() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close();
    }
  }

  terminate() {
    if (this.ws) {
      this.ws.terminate();
    }
  }
}

describe('WebSocket Signaling Integration Tests (Real WS Server)', () => {
  let wsUrl = '';
  const activeClients = [];

  before(async () => {
    process.env.NODE_ENV = 'test';
    if (!server.listening) {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    }
    const address = server.address();
    wsUrl = `ws://127.0.0.1:${address.port}/peerjs/ws`;
  });

  after(async () => {
    activeClients.forEach((c) => c.close());
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function createClient() {
    const client = new TestWsClient(wsUrl);
    await client.connect();
    activeClients.push(client);
    return client;
  }

  it('1. join: client receives room-state on joining empty room', async () => {
    const client = await createClient();
    client.send({
      type: 'join',
      roomId: 'test-room-join-1',
      peerId: 'peer-alice-01',
      nickname: 'Alice',
      isMuted: false,
      isDeafened: false,
    });

    const state = await client.waitFor((m) => m.type === 'room-state');
    assert.strictEqual(state.type, 'room-state');
    assert.ok(Array.isArray(state.peers));
    assert.strictEqual(state.peers.length, 0, 'First peer in room should see 0 existing peers');
    assert.ok(Array.isArray(state.iceServers), 'Must provide iceServers');
  });

  it('2. peer join: second client receives first client in room-state, first receives user-joined', async () => {
    const roomId = 'test-room-mesh-2';
    const client1 = await createClient();
    const client2 = await createClient();

    // Client 1 joins
    client1.send({
      type: 'join',
      roomId,
      peerId: 'peer-c1',
      nickname: 'User 1',
    });
    await client1.waitFor((m) => m.type === 'room-state');

    // Client 2 joins
    client2.send({
      type: 'join',
      roomId,
      peerId: 'peer-c2',
      nickname: 'User 2',
    });

    const [c2State, c1JoinedNotification] = await Promise.all([
      client2.waitFor((m) => m.type === 'room-state'),
      client1.waitFor((m) => m.type === 'user-joined'),
    ]);

    assert.strictEqual(c2State.peers.length, 1);
    assert.strictEqual(c2State.peers[0].peerId, 'peer-c1');
    assert.strictEqual(c1JoinedNotification.peer.peerId, 'peer-c2');
  });

  it('3. signaling: forwards WebRTC SDP offer and candidate between peers', async () => {
    const roomId = 'test-room-signal-3';
    const client1 = await createClient();
    const client2 = await createClient();

    client1.send({ type: 'join', roomId, peerId: 'peer-sig-1', nickname: 'Sig1' });
    await client1.waitFor((m) => m.type === 'room-state');

    client2.send({ type: 'join', roomId, peerId: 'peer-sig-2', nickname: 'Sig2' });
    await client2.waitFor((m) => m.type === 'room-state');

    // Client 1 signals Client 2
    const fakeOffer = { description: { type: 'offer', sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1' } };
    client1.send({
      type: 'signal',
      to: 'peer-sig-2',
      data: fakeOffer,
    });

    const receivedSignal = await client2.waitFor((m) => m.type === 'signal' && m.from === 'peer-sig-1');
    assert.strictEqual(receivedSignal.from, 'peer-sig-1');
    assert.deepStrictEqual(receivedSignal.data, fakeOffer);
  });

  it('4. chat: broadcasts sanitized text and timestamp to all peers in room', async () => {
    const roomId = 'test-room-chat-4';
    const client1 = await createClient();
    const client2 = await createClient();

    client1.send({ type: 'join', roomId, peerId: 'peer-chat-1', nickname: 'Alice' });
    await client1.waitFor((m) => m.type === 'room-state');

    client2.send({ type: 'join', roomId, peerId: 'peer-chat-2', nickname: 'Bob' });
    await client2.waitFor((m) => m.type === 'room-state');

    // Alice sends chat
    client1.send({
      type: 'chat-message',
      text: '   Привет всем!   ',
    });

    const received = await client2.waitFor((m) => m.type === 'chat-message');
    assert.ok(received.message, 'Broadcast must contain message object');
    assert.strictEqual(received.message.text, 'Привет всем!', 'Must be trimmed');
    assert.strictEqual(received.message.nickname, 'Alice');
    assert.strictEqual(received.message.peerId, 'peer-chat-1');
    assert.strictEqual(typeof received.message.timestamp, 'number');
  });

  it('5. mute & deafen: broadcasts audio state changes to room', async () => {
    const roomId = 'test-room-state-5';
    const client1 = await createClient();
    const client2 = await createClient();

    client1.send({ type: 'join', roomId, peerId: 'peer-mute-1', nickname: 'Muter' });
    await client1.waitFor((m) => m.type === 'room-state');

    client2.send({ type: 'join', roomId, peerId: 'peer-mute-2', nickname: 'Listener' });
    await client2.waitFor((m) => m.type === 'room-state');

    client1.send({ type: 'update-mute', isMuted: true });
    const muteMsg = await client2.waitFor((m) => m.type === 'user-muted');
    assert.strictEqual(muteMsg.peerId, 'peer-mute-1');
    assert.strictEqual(muteMsg.isMuted, true);

    client1.send({ type: 'update-deafen', isDeafened: true });
    const deafenMsg = await client2.waitFor((m) => m.type === 'user-deafened');
    assert.strictEqual(deafenMsg.peerId, 'peer-mute-1');
    assert.strictEqual(deafenMsg.isDeafened, true);
  });

  it('6. leave: cleanly notifies remaining peers with user-left', async () => {
    const roomId = 'test-room-leave-6';
    const client1 = await createClient();
    const client2 = await createClient();

    client1.send({ type: 'join', roomId, peerId: 'peer-stay', nickname: 'Stayer' });
    await client1.waitFor((m) => m.type === 'room-state');

    client2.send({ type: 'join', roomId, peerId: 'peer-go', nickname: 'Leaver' });
    await client2.waitFor((m) => m.type === 'room-state');

    client2.send({ type: 'leave' });
    client2.close();

    const leftMsg = await client1.waitFor((m) => m.type === 'user-left');
    assert.strictEqual(leftMsg.peerId, 'peer-go');
  });

  it('7. duplicate identity: new connection with same peerId evicts old connection cleanly', async () => {
    const roomId = 'test-room-dup-7';
    const client1 = await createClient();

    client1.send({ type: 'join', roomId, peerId: 'peer-same-id', nickname: 'First' });
    await client1.waitFor((m) => m.type === 'room-state');

    // Connect second client with IDENTICAL peerId
    const client2 = await createClient();
    let client1Closed = false;
    client1.ws.on('close', () => {
      client1Closed = true;
    });

    client2.send({ type: 'join', roomId, peerId: 'peer-same-id', nickname: 'Second' });
    const state2 = await client2.waitFor((m) => m.type === 'room-state');

    assert.strictEqual(state2.type, 'room-state');
    // Allow brief event tick for socket close
    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(client1Closed, true, 'Original connection must be closed upon duplicate join');
  });

  it('8. room capacity limit: 13th peer is rejected with room_full error', async () => {
    const roomId = 'test-room-limit-12';
    const peers = [];

    // Connect 12 peers
    for (let i = 1; i <= 12; i++) {
      const c = await createClient();
      peers.push(c);
      c.send({ type: 'join', roomId, peerId: `peer-full-${i}`, nickname: `User ${i}` });
      await c.waitFor((m) => m.type === 'room-state');
    }

    // Attempt 13th peer
    const client13 = await createClient();
    client13.send({ type: 'join', roomId, peerId: 'peer-overflow-13', nickname: 'User 13' });

    const errorMsg = await client13.waitFor((m) => m.type === 'error');
    assert.strictEqual(errorMsg.code, 'room_full');
    assert.ok(errorMsg.message.includes('12'));
  });

  it('9. negative cases: malformed JSON payload does not crash server and returns error', async () => {
    const client = await createClient();
    client.send('this is not valid json { [ ]');

    const err = await client.waitFor((m) => m.type === 'error');
    assert.strictEqual(err.code, 'invalid_message');
    assert.strictEqual(typeof err.message, 'string');
    assert.strictEqual(err.stack, undefined, 'Must never leak stack trace');
  });

  it('10. negative cases: unknown message type is rejected', async () => {
    const client = await createClient();
    client.send({
      type: 'join',
      roomId: 'test-room-neg-10',
      peerId: 'peer-neg-10',
    });
    await client.waitFor((m) => m.type === 'room-state');

    client.send({ type: 'malicious-action', foo: 'bar' });
    const err = await client.waitFor((m) => m.type === 'error');
    assert.strictEqual(err.code, 'invalid_message');
    assert.ok(err.message.includes('Unknown message type'));
  });

  it('11. negative cases: signaling self or signaling before join is rejected', async () => {
    const client = await createClient();

    // Signal before join
    client.send({
      type: 'signal',
      to: 'anyone',
      data: { sdp: 'v=0' },
    });
    const unauthErr = await client.waitFor((m) => m.type === 'error' && m.code === 'unauthorized');
    assert.strictEqual(unauthErr.code, 'unauthorized');

    // Now join
    client.send({
      type: 'join',
      roomId: 'test-room-self-sig',
      peerId: 'peer-self-me',
    });
    await client.waitFor((m) => m.type === 'room-state');

    // Signal self
    client.send({
      type: 'signal',
      to: 'peer-self-me',
      data: { sdp: 'v=0' },
    });
    const selfErr = await client.waitFor((m) => m.type === 'error' && m.code === 'invalid_signal');
    assert.strictEqual(selfErr.code, 'invalid_signal');
  });

  it('12. negative cases: empty or whitespace chat message is rejected', async () => {
    const client = await createClient();
    client.send({
      type: 'join',
      roomId: 'test-room-empty-chat',
      peerId: 'peer-empty-chat',
    });
    await client.waitFor((m) => m.type === 'room-state');

    client.send({ type: 'chat-message', text: '     ' });
    const err = await client.waitFor((m) => m.type === 'error' && m.code === 'invalid_message');
    assert.strictEqual(err.code, 'invalid_message');
  });
});
