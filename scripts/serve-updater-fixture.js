import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { FIXTURE_SCENARIOS, fixtureResponse } from './updater-fixture.js';
import { verifyArtifact } from './release-security.js';

const [directory, scenario = 'bad-signature'] = process.argv.slice(2);
if (!directory || !FIXTURE_SCENARIOS.includes(scenario)) throw new Error('Use: node scripts/serve-updater-fixture.js <fixture directory> [bad-signature|tampered|valid]');
const root = fs.realpathSync(directory);
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json'), 'utf8'));
if (!metadata.complete || !metadata.tlsDirectory) throw new Error('Build an entire fixture first');
const original = {};
for (const asset of [metadata.target.portable, metadata.target.installer].filter(Boolean)) {
  if (asset.file !== path.basename(asset.file)) throw new Error('Unsafe artifact path');
  const file = path.join(root, asset.file);
  verifyArtifact(file, asset.signature, metadata.publicKey);
  original[asset.file] = fs.readFileSync(file);
}
const { manifest, payloads } = fixtureResponse(metadata, original, scenario);
const server = https.createServer({
  cert: fs.readFileSync(path.join(metadata.tlsDirectory, 'server.pem')),
  key: fs.readFileSync(path.join(metadata.tlsDirectory, 'server-key.pem')),
}, (request, response) => {
  if (request.method !== 'GET') { response.writeHead(405).end(); return; }
  const pathname = new URL(request.url, 'https://localhost:9443').pathname;
  const bytes = pathname === '/latest.json' ? Buffer.from(JSON.stringify(manifest)) : payloads[pathname];
  if (!bytes) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': pathname === '/latest.json' ? 'application/json' : 'application/octet-stream',
    'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
  response.end(bytes);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(9443, '127.0.0.1', () => console.log(`Local signed updater fixture: https://localhost:9443/latest.json; scenario=${scenario}. Ctrl+C stops it.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(); server.closeAllConnections();
});
