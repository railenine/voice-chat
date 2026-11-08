import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { verifyArtifact, validateReleaseAssets } from './release-security.js';

const readJson = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export function checkReleaseSource(root) {
  const pkg = readJson(root, 'package.json');
  const config = readJson(root, 'src-tauri/tauri.conf.json');
  const source = read(root, 'src/config.ts');
  const versions = [config.version, readJson(root, 'package-lock.json').version,
    readJson(root, 'package-lock.json').packages[''].version,
    readJson(root, 'public/health').version,
    source.match(/export const APP_VERSION\s*=\s*'([^']+)'/)?.[1],
    read(root, 'server/index.js').match(/const APP_VERSION\s*=\s*'([^']+)'/)?.[1],
    read(root, 'src-tauri/Cargo.toml').match(/^version\s*=\s*"([^"]+)"/m)?.[1],
    read(root, 'src-tauri/Cargo.lock').match(/name = "voice-chat"\r?\nversion = "([^"]+)"/)?.[1]];
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version) || versions.some(v => v !== pkg.version)) {
    throw new Error('Release source versions disagree');
  }
  if (process.env.TAG_NAME && process.env.TAG_NAME !== `v${pkg.version}`) throw new Error('Tag does not match source version');
  if (process.env.VITE_RVXIS_STAGING || process.env.TAURI_CONFIG || process.env.CARGO_FEATURE_STAGING ||
      !/const USE_LOCAL_SERVER_FOR_TAURI_TESTS\s*=\s*false;/.test(source) ||
      config.identifier !== 'com.railenine.voicechat' || config.productName !== 'RVxis' ||
      !/PRODUCTION_SERVER\s*=\s*'https:\/\/rvxis.site'/.test(source) ||
      !/PRODUCTION_WS\s*=\s*'wss:\/\/rvxis.site\/peerjs\/ws'/.test(source)) {
    throw new Error('Release must use production identity and backend without test overrides');
  }
  if (config.plugins.updater.pubkey.trim() !== read(root, 'src-tauri/voicechat.key.pub').trim()) {
    throw new Error('Updater public keys disagree');
  }
  return { version: pkg.version, config };
}

export function releaseCandidateReport(root, sourceCommit) {
  const { version, config } = checkReleaseSource(root);
  const manifest = readJson(root, 'latest.json');
  if (manifest.version !== version) throw new Error('Manifest version does not match source');
  validateReleaseAssets(manifest);
  const installer = `RVxis_${version}_x64-setup.exe`;
  const artifacts = [
    ['portable', manifest.portable['windows-x86_64'], 'src-tauri/target/release/RVxis.exe', 'RVxis.exe'],
    ['installer', manifest.platforms['windows-x86_64'], `src-tauri/target/release/bundle/nsis/${installer}`, installer],
  ].map(([kind, asset, file, name]) => {
    if (asset.url !== `https://github.com/railenine/voice-chat/releases/download/v${version}/${name}`) {
      throw new Error('Unexpected release asset URL');
    }
    const local = path.join(root, file);
    const bytes = fs.readFileSync(local);
    if (bytes.length !== asset.size || sha256(bytes) !== asset.sha256) throw new Error('Release asset size/hash mismatch');
    verifyArtifact(local, asset.signature, config.plugins.updater.pubkey);
    return { kind, file: name, bytes: bytes.length, sha256: asset.sha256, signatureVerified: true };
  });
  return {
    version, sourceCommit, publicKeySha256: sha256(config.plugins.updater.pubkey.trim()),
    manifestSha256: sha256(fs.readFileSync(path.join(root, 'latest.json'))),
    identifier: config.identifier, backend: 'https://rvxis.site',
    publication: 'This report does not publish a release or deploy a backend.', artifacts,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (process.argv.includes('--check-source')) {
    console.log(`Release source checked: ${checkReleaseSource(root).version}`);
  } else {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const report = releaseCandidateReport(root, commit);
    fs.writeFileSync(path.join(root, 'release-candidate.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  }
}
