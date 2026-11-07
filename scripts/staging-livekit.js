import fs from 'node:fs';
import { readStaticTurnCredentials, readLiveKitCredentials } from './staging-turn-config.js';

if (process.env.HOST !== '127.0.0.1' || process.env.PORT !== '3102' || process.env.DISABLE_LIVEKIT !== '1') {
  throw new Error('Use staging-local.sh --livekit for this isolated test.');
}
const revision = process.env.RVXIS_RELEASE?.match(/^app-([a-f0-9]{12,40})-livekit$/)?.[1];
if (!revision) throw new Error('A dedicated app-<revision>-livekit directory is required.');
const index = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
if (index.includes('staging-relay-probe.js')) throw new Error('Use the normal frontend, without the forced-relay probe.');
try {
  const content = fs.readFileSync('/var/www/voice-chat-backend/.env', 'utf8');
  Object.assign(process.env, readStaticTurnCredentials(content), readLiveKitCredentials(content));
} catch { throw new Error('Cannot load existing TURN/LiveKit configuration. Credentials are never printed.'); }
Object.assign(process.env, { COTURN_SHARED_SECRET: '', COTURN_DOMAIN: 'rvxis.site', COTURN_PORT: '3478',
  COTURN_TLS_PORT: '5349', DISABLE_LIVEKIT: '0', LIVEKIT_ROOM_PREFIX: `rvxis-staging-${revision}-` });
console.log(`[Staging] LiveKit enabled. Room prefix: ${process.env.LIVEKIT_ROOM_PREFIX}`);
console.log('[Staging] Credentials in memory only. The SFU is shared; production services are unchanged.');
await import('../server/index.js');
