import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('production startup honors HOST so staging can remain loopback-only', async () => {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { once } from 'node:events';
    const { server } = await import('./server/index.js');
    if (!server.listening) await once(server, 'listening');
    process.send(server.address());
    await new Promise(resolve => server.close(resolve));
    process.exit(0);
  `], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '0',
      DISABLE_LIVEKIT: '1', LIVEKIT_API_KEY: 'test-only', LIVEKIT_API_SECRET: 'test-only',
      LIVEKIT_URL: 'http://127.0.0.1:1', COTURN_PASSWORD: 'test-only', COTURN_SHARED_SECRET: '' },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  const exited = once(child, 'exit');
  try {
    const [address] = await once(child, 'message', { signal: AbortSignal.timeout(10_000) });
    assert.equal(address.address, '127.0.0.1');
    assert.equal(address.family, 'IPv4');
    assert.ok(address.port > 0);
    assert.deepEqual(await exited, [0, null]);
  } finally {
    if (child.exitCode === null) child.kill();
  }
});
