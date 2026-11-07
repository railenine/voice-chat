import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

async function start() {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { once } from 'node:events';
    const { server } = await import('./server/index.js');
    if (!server.listening) await once(server, 'listening');
    process.on('message', signal => process.emit(signal));
    process.send(server.address());
  `], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '0',
      DISABLE_LIVEKIT: '1', LIVEKIT_API_KEY: 'test-only', LIVEKIT_API_SECRET: 'test-only',
      LIVEKIT_URL: 'http://127.0.0.1:1', COTURN_PASSWORD: 'test-only', COTURN_SHARED_SECRET: '' },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  try {
    const [address] = await once(child, 'message', { signal: AbortSignal.timeout(10_000) });
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/peerjs/ws`);
    await once(ws, 'open', { signal: AbortSignal.timeout(5000) });
    return { child, ws };
  } catch (error) { child.kill(); throw error; }
}

// Emit the signal event inside the child: Windows kill() does not deliver Unix
// SIGINT handlers. This exercises the production handlers with real sockets.
test('SIGINT closes active WebSockets and exits without waiting for tabs to close', async () => {
  const { child, ws } = await start();
  try {
    const closed = once(ws, 'close', { signal: AbortSignal.timeout(3000) });
    const exited = once(child, 'exit', { signal: AbortSignal.timeout(3000) });
    child.send('SIGINT');
    const [[code], exit] = await Promise.all([closed, exited]);
    assert.equal(code, 1001);
    assert.deepEqual(exit, [0, null]);
  } finally { ws.terminate(); if (child.exitCode === null) child.kill(); }
});

test('SIGTERM has a bounded shutdown even when a WebSocket stops reading', async () => {
  const { child, ws } = await start();
  try {
    ws.pause();
    const exited = once(child, 'exit', { signal: AbortSignal.timeout(8000) });
    child.send('SIGTERM');
    child.send('SIGINT'); // Repeated signals must not create a second shutdown.
    assert.deepEqual(await exited, [0, null]);
  } finally { ws.terminate(); if (child.exitCode === null) child.kill(); }
});
