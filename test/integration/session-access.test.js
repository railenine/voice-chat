import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { WebSocket } from 'ws';
import { server } from '../../server/index.js';
import { isAllowedOrigin } from '../../server/access.js';

describe('Session ownership and protected resources', () => {
  let base;
  const clients = [];
  before(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    for (const ws of clients) ws.terminate();
    await new Promise(resolve => server.close(resolve));
  });
  async function join(peerId, token) {
    const ws = new WebSocket(base.replace('http', 'ws') + '/peerjs/ws');
    clients.push(ws);
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const result = new Promise(resolve => ws.once('message', data => resolve(JSON.parse(data))));
    ws.send(JSON.stringify({ type: 'join', roomId: 'secure-room', peerId, sessionToken: token }));
    return { ws, message: await result };
  }
  it('uses exact origins, including native origins, in production', async () => {
    const env = { NODE_ENV: 'production' };
    assert.equal(isAllowedOrigin('https://rvxis.site', env), true);
    assert.equal(isAllowedOrigin('https://rvxis.site.attacker.test', env), false);
    assert.equal(isAllowedOrigin('http://tauri.attacker.test', env), false);
    assert.equal(isAllowedOrigin('http://tauri.localhost', env), true);
    assert.equal(isAllowedOrigin('https://localhost.attacker.test', { NODE_ENV: 'development' }), false);
    const response = await fetch(base + '/health', { headers: { Origin: 'https://rvxis.site.attacker.test' } });
    assert.equal(response.status, 403);
    const ws = new WebSocket(base.replace('http', 'ws') + '/peerjs/ws', { origin: 'https://rvxis.site.attacker.test' });
    await new Promise(resolve => {
      ws.once('unexpected-response', (_req, res) => { assert.equal(res.statusCode, 403); res.resume(); ws.terminate(); resolve(); });
      ws.on('error', () => {});
    });
  });
  it('blocks identity theft, binds HTTP access, supports reconnect, and revokes on leave', async () => {
    const owner = await join('owner-peer');
    const token = owner.message.sessionToken;
    assert.match(token, /^[a-f0-9]{64}$/);
    const attacker = await join('owner-peer');
    assert.equal(attacker.message.code, 'identity_in_use');
    assert.equal(owner.ws.readyState, WebSocket.OPEN);
    const headers = { Authorization: `Bearer ${token}` };
    const ice = '/peerjs/ice-servers?roomId=secure-room&peerId=owner-peer';
    assert.equal((await fetch(base + ice)).status, 401);
    assert.equal((await fetch(base + ice, { headers })).status, 200);
    assert.equal((await fetch(base + ice.replace('owner-peer', 'other-peer'), { headers })).status, 401);
    const uploadHeaders = { 'content-type': 'image/png', 'x-room-id': 'secure-room', 'x-peer-id': 'owner-peer' };
    assert.equal((await fetch(base + '/api/upload', { method: 'POST', headers: uploadHeaders, body: Buffer.alloc(12) })).status, 401);
    const oldKey = process.env.LIVEKIT_API_KEY, oldSecret = process.env.LIVEKIT_API_SECRET;
    process.env.LIVEKIT_API_KEY = 'test-key'; process.env.LIVEKIT_API_SECRET = 'test-only-secret-at-least-32-characters';
    try {
      const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomId: 'secure-room', peerId: 'owner-peer' }) };
      assert.equal((await fetch(base + '/api/livekit/token', options)).status, 401);
      const res = await fetch(base + '/api/livekit/token', { ...options, headers: { ...options.headers, ...headers } });
      assert.equal(res.status, 200);
      const jwt = JSON.parse(Buffer.from((await res.json()).token.split('.')[1], 'base64url'));
      assert.equal(jwt.sub, 'owner-peer');
      assert.equal(jwt.video.canPublishData, false);
      assert.deepEqual(jwt.video.canPublishSources, ['screen_share', 'screen_share_audio']);
      assert.ok(jwt.exp - jwt.nbf <= 600);
    } finally {
      if (oldKey === undefined) delete process.env.LIVEKIT_API_KEY; else process.env.LIVEKIT_API_KEY = oldKey;
      if (oldSecret === undefined) delete process.env.LIVEKIT_API_SECRET; else process.env.LIVEKIT_API_SECRET = oldSecret;
    }
    const ownerClosed = new Promise(resolve => owner.ws.once('close', resolve));
    const reconnected = await join('owner-peer', token);
    await ownerClosed;
    assert.equal(reconnected.message.sessionToken, token);
    const leaveAck = new Promise(resolve => reconnected.ws.once('close', resolve));
    reconnected.ws.send(JSON.stringify({ type: 'leave' })); reconnected.ws.close(); await leaveAck;
    assert.equal((await fetch(base + ice, { headers })).status, 401);
  });
  it('binds staging LiveKit grants to the server namespace and ignores a requested override', async () => {
    const owner = await join('namespace-peer');
    const fields = ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_ROOM_PREFIX', 'DISABLE_LIVEKIT'];
    const previous = Object.fromEntries(fields.map(key => [key, process.env[key]]));
    Object.assign(process.env, { LIVEKIT_API_KEY: 'test-key', LIVEKIT_API_SECRET: 'test-only-secret-at-least-32-characters',
      LIVEKIT_ROOM_PREFIX: 'rvxis-staging-test-', DISABLE_LIVEKIT: '0' });
    try {
      const options = { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${owner.message.sessionToken}` },
        body: JSON.stringify({ roomId: 'secure-room', peerId: 'namespace-peer', room: 'working-room', prefix: '' }) };
      const response = await fetch(base + '/api/livekit/token', options);
      assert.equal(response.status, 200);
      const result = await response.json();
      const jwt = JSON.parse(Buffer.from(result.token.split('.')[1], 'base64url'));
      assert.equal(result.room, 'rvxis-staging-test-secure-room');
      assert.equal(jwt.video.room, result.room);
      assert.equal(jwt.video.roomJoin, true);
      assert.equal(jwt.video.roomAdmin, undefined);
      assert.deepEqual(jwt.video.canPublishSources, ['screen_share', 'screen_share_audio']);
      process.env.LIVEKIT_ROOM_PREFIX = 'invalid/prefix';
      assert.equal((await fetch(base + '/api/livekit/token', options)).status, 500);
    } finally {
      for (const key of fields) {
        if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
      }
    }
  });
});
