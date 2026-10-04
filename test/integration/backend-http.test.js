import assert from 'node:assert';
import test, { describe, it, before, after } from 'node:test';
import { server } from '../../server/index.js';

describe('Backend HTTP Integration Tests (Real Server & Endpoints)', () => {
  let baseUrl = '';

  before(async () => {
    process.env.NODE_ENV = 'test';
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /health returns 200 with server status, service name, and version', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.service, 'rvxis-server');
    assert.strictEqual(typeof data.version, 'string');
    assert.strictEqual(typeof data.timestamp, 'string');
  });

  it('GET /peerjs/info returns 200 with signaling protocol details', async () => {
    const res = await fetch(`${baseUrl}/peerjs/info`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.name, 'RVxis Server');
    assert.strictEqual(data.signaling, 'websocket');
    assert.strictEqual(data.path, '/peerjs/ws');
    assert.strictEqual(data.status, 'running');
  });

  it('GET /api/livekit/status returns livekit availability status', async () => {
    const res = await fetch(`${baseUrl}/api/livekit/status`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(typeof data.available, 'boolean');
  });

  it('POST /api/livekit/token rejects request missing roomId with 400', async () => {
    const res = await fetch(`${baseUrl}/api/livekit/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Alice', peerId: 'peer-alice-01' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'invalid_room_id');
  });

  it('POST /api/livekit/token rejects invalid roomId characters with 400', async () => {
    const res = await fetch(`${baseUrl}/api/livekit/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: 'bad$room$name!',
        peerId: 'peer-valid-123',
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'invalid_room_id');
  });

  it('POST /api/livekit/token returns 503 when LiveKit secret is missing in env', async () => {
    const origKey = process.env.LIVEKIT_API_KEY;
    const origSecret = process.env.LIVEKIT_API_SECRET;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;

    try {
      const res = await fetch(`${baseUrl}/api/livekit/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: 'valid-room-101',
          peerId: 'valid-peer-101',
          nickname: 'Alice',
        }),
      });
      assert.strictEqual(res.status, 503);
      const data = await res.json();
      assert.strictEqual(data.error, 'livekit_not_configured');
    } finally {
      if (origKey) process.env.LIVEKIT_API_KEY = origKey;
      if (origSecret) process.env.LIVEKIT_API_SECRET = origSecret;
    }
  });

  it('Enforces 10kb JSON body size limit (payload too large returns 413)', async () => {
    const oversizedBody = JSON.stringify({
      data: 'x'.repeat(12 * 1024), // 12kb payload
    });

    const res = await fetch(`${baseUrl}/api/livekit/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversizedBody,
    });
    assert.strictEqual(res.status, 413);
  });

  it('GET /peerjs/updater/latest.json supports cache-busting timestamp', async () => {
    const timestamp = Date.now();
    const res = await fetch(`${baseUrl}/peerjs/updater/latest.json?_t=${timestamp}`);
    assert.ok(res.status === 200 || res.status === 404);
  });
});
