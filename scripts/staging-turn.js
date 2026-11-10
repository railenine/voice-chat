import fs from 'node:fs';
import { readStaticTurnCredentials } from './staging-turn-config.js';

if (process.env.HOST !== '127.0.0.1' || process.env.PORT !== '3102' || process.env.DISABLE_LIVEKIT !== '1') {
  throw new Error('Use staging-local.sh --turn for this isolated test.');
}
const index = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
if (!index.includes('<script src="/staging-relay-probe.js"></script>')) {
  throw new Error('A relay-only staging frontend is required.');
}
try {
  Object.assign(process.env, readStaticTurnCredentials(fs.readFileSync('/var/www/voice-chat-backend/.env', 'utf8')));
} catch {
  throw new Error('Cannot load the existing static TURN account. Credentials are never printed.');
}
Object.assign(process.env, { COTURN_SHARED_SECRET: '', COTURN_DOMAIN: 'rvxis.site', COTURN_PORT: '3478', COTURN_TLS_PORT: '5349' });
console.log('[Staging] Existing TURN account loaded in memory; LiveKit remains disabled.');
await import('../server/index.js');
