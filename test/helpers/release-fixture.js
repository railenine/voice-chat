import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { signArtifact } from '../../scripts/release-security.js';
import { releaseCandidateReport } from '../../scripts/release-candidate.js';

export function releaseFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvxis-promotion-test-'));
  const sourceRoot = path.join(root, 'source'), artifactRoot = path.join(root, 'artifact');
  const write = (base, file, value) => {
    const target = path.join(base, file); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2));
  };
  for (const file of ['package.json', 'package-lock.json', 'public/health', 'src/config.ts', 'server/index.js',
    'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'src-tauri/tauri.conf.json', 'src-tauri/voicechat.key.pub']) {
    write(sourceRoot, file, fs.readFileSync(file));
  }
  const source = 'a'.repeat(40), key = path.join(root, 'test.key');
  execFileSync(process.execPath, [path.resolve('node_modules/@tauri-apps/cli/tauri.js'), 'signer', 'generate',
    '--ci', '-p', 'test-only', '-w', key], { stdio: 'ignore' });
  const publicKey = fs.readFileSync(key + '.pub', 'utf8');
  const config = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'src-tauri/tauri.conf.json')));
  config.plugins.updater.pubkey = publicKey;
  write(sourceRoot, 'src-tauri/tauri.conf.json', config); write(sourceRoot, 'src-tauri/voicechat.key.pub', publicKey);
  const version = config.version;
  function asset(file) {
    write(artifactRoot, file, `signed test bytes ${path.basename(file)}`);
    const target = path.join(artifactRoot, file), bytes = fs.readFileSync(target);
    return { url: `https://github.com/railenine/voice-chat/releases/download/v${version}/${path.basename(file)}`,
      size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      signature: signArtifact(target, key, 'test-only', version, publicKey) };
  }
  const portable = asset('src-tauri/target/release/RVxis.exe');
  const installer = asset(`src-tauri/target/release/bundle/nsis/RVxis_${version}_x64-setup.exe`);
  asset(`src-tauri/target/release/bundle/msi/RVxis_${version}_x64_en-US.msi`);
  write(artifactRoot, 'src-tauri/target/release/voice-chat.exe', fs.readFileSync(path.join(artifactRoot, 'src-tauri/target/release/RVxis.exe')));
  write(artifactRoot, 'latest.json', { version, pub_date: '2026-11-09T00:00:00Z',
    platforms: { 'windows-x86_64': installer }, portable: { 'windows-x86_64': portable }, portable_url: portable.url });
  write(artifactRoot, 'RELEASE_NOTES.md', 'Signed fixture release notes.');
  write(artifactRoot, 'release-candidate.json', releaseCandidateReport(sourceRoot, source, artifactRoot));
  return { root, sourceRoot, artifactRoot, source, version,
    cleanup() {
      assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('rvxis-promotion-test-'));
      fs.rmSync(root, { recursive: true, force: true });
    } };
}
