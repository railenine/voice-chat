import assert from 'node:assert/strict';
import { it } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { checkReleaseSource, releaseCandidateReport } from '../../scripts/release-candidate.js';
import { signArtifact } from '../../scripts/release-security.js';

it('release preparation verifies both signed artifacts and rejects stale bytes and test configuration', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvxis-candidate-'));
  const write = (file, value) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  };
  try {
    for (const file of ['package.json', 'package-lock.json', 'public/health', 'src/config.ts', 'server/index.js',
      'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'src-tauri/tauri.conf.json', 'src-tauri/voicechat.key.pub']) {
      write(file, fs.readFileSync(file, 'utf8'));
    }
    const { version } = checkReleaseSource(root);
    const key = path.join(root, 'ephemeral.key');
    execFileSync(process.execPath, [path.resolve('node_modules/@tauri-apps/cli/tauri.js'), 'signer', 'generate',
      '--ci', '-p', 'test-only', '-w', key], { stdio: 'ignore' });
    const publicKey = fs.readFileSync(key + '.pub', 'utf8');
    const config = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json')));
    config.plugins.updater.pubkey = publicKey;
    write('src-tauri/tauri.conf.json', config);
    write('src-tauri/voicechat.key.pub', publicKey);
    const asset = (file, name) => {
      write(file, `signed test bytes for ${name}`);
      const local = path.join(root, file);
      const bytes = fs.readFileSync(local);
      return { url: `https://github.com/railenine/voice-chat/releases/download/v${version}/${name}`,
        size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        signature: signArtifact(local, key, 'test-only', version, publicKey) };
    };
    const portableFile = 'src-tauri/target/release/RVxis.exe';
    const manifest = { version,
      platforms: { 'windows-x86_64': asset(`src-tauri/target/release/bundle/nsis/RVxis_${version}_x64-setup.exe`, `RVxis_${version}_x64-setup.exe`) },
      portable: { 'windows-x86_64': asset(portableFile, 'RVxis.exe') } };
    write('latest.json', manifest);
    const report = releaseCandidateReport(root, 'a'.repeat(40));
    assert.equal(report.artifacts.length, 2);
    assert.equal(report.artifacts.every(a => a.signatureVerified), true);
    assert.equal(report.version, version);
    // Never sign a cached installer for another version as the new release.
    for (const file of ['scripts/generate-latest-json.js', 'scripts/release-security.js']) {
      write(`stale/${file}`, fs.readFileSync(file, 'utf8'));
    }
    write('stale/package.json', { type: 'module', version });
    write('stale/src-tauri/target/release/bundle/nsis/RVxis_0.0.1_x64-setup.exe', 'cached installer');
    write('stale/src-tauri/target/release/RVxis.exe', 'portable');
    const stale = spawnSync(process.execPath, ['scripts/generate-latest-json.js'], { cwd: path.join(root, 'stale'), encoding: 'utf8' });
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /Missing installer or portable artifact/);
    const original = fs.readFileSync(path.join(root, portableFile));
    write(portableFile, 'modified binary');
    assert.throws(() => releaseCandidateReport(root, 'a'.repeat(40)), /size\/hash/);
    fs.writeFileSync(path.join(root, portableFile), original);
    manifest.portable['windows-x86_64'].signature = '';
    write('latest.json', manifest);
    assert.throws(() => releaseCandidateReport(root, 'a'.repeat(40)), /signed HTTPS/);
    const source = fs.readFileSync(path.join(root, 'src/config.ts'), 'utf8');
    write('src/config.ts', source.replace('USE_LOCAL_SERVER_FOR_TAURI_TESTS = false', 'USE_LOCAL_SERVER_FOR_TAURI_TESTS = true'));
    assert.throws(() => checkReleaseSource(root), /production identity/);
    write('src/config.ts', source);
    write('public/health', { version: '0.0.0' });
    assert.throws(() => checkReleaseSource(root), /versions disagree/);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    assert.ok(path.basename(root).startsWith('rvxis-candidate-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
