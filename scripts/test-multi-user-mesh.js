import { spawn } from 'child_process';
import { WebSocket } from 'ws';

const TEST_PORT = 3288;
const ROOM_ID = 'stress-room-5plus';

console.log('====================================================');
console.log('🧪 Multi-User Mesh & Reconnection Stress Test (5+ Users)');
console.log(`Port: ${TEST_PORT} | Room: #${ROOM_ID}`);
console.log('====================================================\n');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 1. Spawn server instance on dedicated TEST_PORT
const serverProcess = spawn('node', ['server/index.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(TEST_PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});

serverProcess.stderr.on('data', (d) => {
  const msg = d.toString().trim();
  if (msg) console.error(`[Server ERR] ${msg}`);
});

class SimulatedPeer {
  constructor(name, peerId) {
    this.name = name;
    this.peerId = peerId;
    this.ws = null;
    this.receivedEvents = [];
    this.knownPeers = new Map();
  }

  async connect(wsUrl) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.on('open', () => resolve());
      this.ws.on('error', (err) => reject(err));
      this.ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.receivedEvents.push(msg);
          this.handleMessage(msg);
        } catch (e) {}
      });
    });
  }

  handleMessage(msg) {
    if (msg.type === 'room-state') {
      this.knownPeers.clear();
      (msg.peers || []).forEach(p => this.knownPeers.set(p.peerId, p));
    } else if (msg.type === 'user-joined') {
      this.knownPeers.set(msg.peer.peerId, msg.peer);
    } else if (msg.type === 'user-left') {
      this.knownPeers.delete(msg.peerId);
    } else if (msg.type === 'update-nickname') {
      const p = this.knownPeers.get(msg.peerId);
      if (p) p.nickname = msg.nickname;
    }
  }

  join(roomId) {
    this.ws.send(JSON.stringify({
      type: 'join',
      roomId,
      peerId: this.peerId,
      nickname: this.name,
      isMuted: false,
      isDeafened: false,
    }));
  }

  sendSignal(toPeerId, data) {
    this.ws.send(JSON.stringify({
      type: 'signal',
      to: toPeerId,
      data,
    }));
  }

  leave() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'leave' }));
      this.ws.close();
    }
  }

  abruptDisconnect() {
    if (this.ws) {
      this.ws.terminate();
    }
  }
}

async function run() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // Wait for server ready
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
        if (res.ok) { ready = true; break; }
      } catch (e) {}
      await sleep(200);
    }
    if (!ready) throw new Error('Server did not start in time');
    console.log('✓ Test server is healthy and listening\n');

    const wsUrl = `ws://127.0.0.1:${TEST_PORT}/peerjs/ws`;

    // ---------------------------------------------------------
    // Phase 1: Sequential Joins of 6 Users (Alice, Bob, Charlie, David, Eve, Frank)
    // ---------------------------------------------------------
    console.log('--- Phase 1: Sequential Joins (Building 6-Peer Mesh) ---');
    const users = [
      new SimulatedPeer('Алиса', 'peer-alice-01'),
      new SimulatedPeer('Боб', 'peer-bob-02'),
      new SimulatedPeer('Чарли', 'peer-charlie-03'),
      new SimulatedPeer('Давид', 'peer-david-04'),
      new SimulatedPeer('Ева', 'peer-eve-05'),
      new SimulatedPeer('Франк', 'peer-frank-06'),
    ];

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      await u.connect(wsUrl);
      u.join(ROOM_ID);
      await sleep(150);

      // Verify new user received all previously joined peers
      assert(
        u.knownPeers.size === i,
        `${u.name} (user ${i + 1}) joined and received ${i} existing peer(s)`
      );

      // Verify all previously joined peers received user-joined for this new user
      for (let j = 0; j < i; j++) {
        const prevUser = users[j];
        assert(
          prevUser.knownPeers.has(u.peerId),
          `${prevUser.name} received user-joined for ${u.name}`
        );
      }
    }

    console.log(`\n✓ Full 6-way mesh formed. Total peers tracked by Alice: ${users[0].knownPeers.size}`);
    assert(users[0].knownPeers.size === 5, 'Alice knows all 5 other peers');

    // ---------------------------------------------------------
    // Phase 2: Mesh Signaling Routing Verification
    // ---------------------------------------------------------
    console.log('\n--- Phase 2: Full-Mesh Signaling Exchange ---');
    // Test signaling from Eve to Alice
    const eve = users[4];
    const alice = users[0];
    const testOffer = { type: 'offer', sdp: 'v=0\r\ntest-sdp-eve-to-alice\r\n' };
    eve.sendSignal(alice.peerId, { description: testOffer });
    await sleep(100);

    const aliceGotOffer = alice.receivedEvents.find(
      e => e.type === 'signal' && e.from === eve.peerId && e.data?.description?.sdp === testOffer.sdp
    );
    assert(Boolean(aliceGotOffer), 'Alice received direct WebRTC signaling offer from Eve');

    // ---------------------------------------------------------
    // Phase 3: Departure 1 - Graceful Leave (Charlie leaves)
    // ---------------------------------------------------------
    console.log('\n--- Phase 3: Graceful Departure (Charlie leaves) ---');
    const charlie = users[2];
    charlie.leave();
    await sleep(200);

    const remainingAfterCharlie = [users[0], users[1], users[3], users[4], users[5]];
    for (const u of remainingAfterCharlie) {
      assert(
        !u.knownPeers.has(charlie.peerId),
        `${u.name} removed Charlie from known peers after graceful leave`
      );
    }
    assert(remainingAfterCharlie[0].knownPeers.size === 4, 'Remaining peers count is 4');

    // ---------------------------------------------------------
    // Phase 4: Departure 2 - Abrupt TCP Drop (Eve disconnects abruptly)
    // ---------------------------------------------------------
    console.log('\n--- Phase 4: Abrupt Disconnect (Eve drops socket) ---');
    eve.abruptDisconnect();
    await sleep(250);

    const remainingAfterEve = [users[0], users[1], users[3], users[5]]; // Alice, Bob, David, Frank
    for (const u of remainingAfterEve) {
      assert(
        !u.knownPeers.has(eve.peerId),
        `${u.name} removed Eve after server detected abrupt TCP disconnect`
      );
    }
    assert(remainingAfterEve[0].knownPeers.size === 3, 'Remaining peers count is 3 (Alice, Bob, David, Frank)');

    // ---------------------------------------------------------
    // Phase 5: Reconnection (Bob disconnects and reconnects)
    // ---------------------------------------------------------
    console.log('\n--- Phase 5: Peer Reconnection (Bob reconnects after network drop) ---');
    const bob = users[1];
    bob.abruptDisconnect();
    await sleep(200);

    // Remaining peers see Bob disconnect
    const peersWithoutBob = [users[0], users[3], users[5]]; // Alice, David, Frank
    for (const u of peersWithoutBob) {
      assert(
        !u.knownPeers.has(bob.peerId),
        `${u.name} saw Bob leave upon disconnect`
      );
    }

    console.log('  -> Simulating Bob reconnection with fresh WebSocket...');
    const bobReconnected = new SimulatedPeer('Боб (Reconnected)', 'peer-bob-02');
    await bobReconnected.connect(wsUrl);
    bobReconnected.join(ROOM_ID);
    await sleep(250);

    // Verify Bob received the 3 active peers: Alice, David, Frank
    assert(
      bobReconnected.knownPeers.size === 3,
      `Reconnected Bob received all 3 active peers (has ${bobReconnected.knownPeers.size})`
    );
    assert(bobReconnected.knownPeers.has('peer-alice-01'), 'Bob sees Alice');
    assert(bobReconnected.knownPeers.has('peer-david-04'), 'Bob sees David');
    assert(bobReconnected.knownPeers.has('peer-frank-06'), 'Bob sees Frank');

    // Verify Alice, David, Frank received user-joined for reconnected Bob
    for (const u of peersWithoutBob) {
      assert(
        u.knownPeers.has(bob.peerId),
        `${u.name} received user-joined for reconnected Bob`
      );
    }

    // Verify signaling re-establishment between Bob and Alice
    const reconnectedOffer = { type: 'offer', sdp: 'v=0\r\ntest-reconnected-bob-offer\r\n' };
    bobReconnected.sendSignal(alice.peerId, { description: reconnectedOffer });
    await sleep(100);

    const aliceGotReconnectedOffer = alice.receivedEvents.find(
      e => e.type === 'signal' && e.from === bobReconnected.peerId && e.data?.description?.sdp === reconnectedOffer.sdp
    );
    assert(Boolean(aliceGotReconnectedOffer), 'Alice received signaling offer from reconnected Bob to re-establish WebRTC peer connection');

    // ---------------------------------------------------------
    // Phase 6: New Peer Joins After Reconnections (Grace joins)
    // ---------------------------------------------------------
    console.log('\n--- Phase 6: New Peer Joins Room (Grace joins) ---');
    const grace = new SimulatedPeer('Грейс', 'peer-grace-07');
    await grace.connect(wsUrl);
    grace.join(ROOM_ID);
    await sleep(200);

    assert(
      grace.knownPeers.size === 4,
      `Grace sees all 4 active room members (Alice, David, Frank, Bob Reconnected)`
    );

    const allActive = [alice, users[3], users[5], bobReconnected];
    for (const u of allActive) {
      assert(
        u.knownPeers.has(grace.peerId),
        `${u.name} received user-joined for Grace`
      );
    }

    // ---------------------------------------------------------
    // Phase 7: Chat and State Broadcast in Mesh
    // ---------------------------------------------------------
    console.log('\n--- Phase 7: In-Room Broadcasts (Speaking, Mute, Chat) ---');
    grace.ws.send(JSON.stringify({
      type: 'chat-message',
      text: 'Привет всем!'
    }));
    await sleep(150);

    const aliceGotChat = alice.receivedEvents.find(
      e => e.type === 'chat-message' && e.message?.text === 'Привет всем!'
    );
    assert(Boolean(aliceGotChat), 'Alice received in-room chat message from Grace');

    // ---------------------------------------------------------
    // Phase 8: Simultaneous Multi-Peer Reconnection & VPN Glitch Simulation
    // ---------------------------------------------------------
    console.log('\n--- Phase 8: Simultaneous Reconnections & Ghost Socket Eviction (VPN Drop Simulation) ---');
    const david = users[3];
    const frank = users[5];

    // Both David and Frank drop sockets abruptly (VPN disconnect simulation)
    console.log('  -> Simulating simultaneous VPN disconnect for David and Frank...');
    david.abruptDisconnect();
    frank.abruptDisconnect();
    await sleep(200);

    // Frank reconnects immediately with the same nickname and peerId
    console.log('  -> Frank reconnects immediately...');
    const frankReconnected = new SimulatedPeer('Франк', frank.peerId);
    await frankReconnected.connect(wsUrl);
    frankReconnected.join(ROOM_ID);
    await sleep(200);

    // David reconnects with new peerId but same nickname (simulating browser page refresh / fresh session)
    console.log('  -> David reconnects with new session peerId and same nickname...');
    const davidReconnected = new SimulatedPeer('Давид', 'peer-david-04-refreshed');
    await davidReconnected.connect(wsUrl);
    davidReconnected.join(ROOM_ID);
    await sleep(250);

    // Verify current active mesh members: Alice, Bob (reconnected), Grace, Frank (reconnected), David (reconnected) = 5 peers
    const finalActiveUsers = [alice, bobReconnected, grace, frankReconnected, davidReconnected];
    console.log(`\n  Checking consistency across all 5 active peers...`);
    for (const u of finalActiveUsers) {
      assert(
        u.knownPeers.size === 4,
        `${u.name} correctly sees exactly 4 other peers (no duplicate ghost sockets, no missing peers)`
      );
    }

    // Verify David (refreshed peerId) evicted any stale 'peer-david-04'
    for (const u of [alice, bobReconnected, grace, frankReconnected]) {
      assert(
        !u.knownPeers.has('peer-david-04'),
        `${u.name} does NOT contain stale previous peerId for David`
      );
      assert(
        u.knownPeers.has('peer-david-04-refreshed'),
        `${u.name} contains current refreshed peerId for David`
      );
    }

    // Verify state synchronization (mute toggle broadcast)
    frankReconnected.ws.send(JSON.stringify({
      type: 'update-mute',
      isMuted: true
    }));
    await sleep(150);

    const aliceSawFrankMuted = alice.receivedEvents.find(
      e => e.type === 'user-muted' && e.peerId === frankReconnected.peerId && e.isMuted === true
    );
    assert(Boolean(aliceSawFrankMuted), 'Alice received mute update from Frank after reconnection');

    console.log('\n====================================================');
    console.log(`🎉 ALL STRESS TESTS PASSED: ${passed} checks passed, ${failed} failed!`);
    console.log('====================================================\n');
  } finally {
    serverProcess.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('\n❌ Stress test crashed:', err);
  serverProcess.kill('SIGTERM');
  process.exit(1);
});
