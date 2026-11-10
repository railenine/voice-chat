import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// This process imports only an archived source tree without developer .env files.
const root = path.resolve(process.argv[2]);
if (fs.existsSync(path.join(root, '.env'))) throw new Error('Refusing snapshot with .env');
Object.assign(process.env, { NODE_ENV: 'test', LIVEKIT_URL: 'ws://127.0.0.1:1',
  LIVEKIT_API_KEY: 'compat-test', LIVEKIT_API_SECRET: 'compat-test-secret-at-least-32-characters',
  COTURN_DOMAIN: '127.0.0.1', COTURN_PASSWORD: 'compat-test', COTURN_SHARED_SECRET: '',
  CORS_ORIGIN: '*', HOST: '127.0.0.1' });
const { server, wss } = await import(pathToFileURL(path.join(root, 'server/index.js')));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
process.send({ base: `http://127.0.0.1:${server.address().port}` });
process.on('message', async message => {
  if (message !== 'stop') return;
  for (const ws of wss.clients) ws.terminate();
  await new Promise(resolve => wss.close(resolve));
  await new Promise(resolve => server.close(resolve));
  process.exit(0);
});
process.on('disconnect', () => process.exit(0));
