import assert from 'node:assert/strict';
import { it } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { signArtifact, verifyArtifact, validateReleaseAssets } from '../../scripts/release-security.js';

it('signs actual artifacts with Tauri and rejects tampered, unsigned or foreign artifacts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvxis-sign-test-'));
  const key = path.join(dir, 'ephemeral.key');
  const binary = path.join(dir, 'artifact.bin');
  const cli = path.resolve('node_modules/@tauri-apps/cli/tauri.js');
  const inheritedKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
  const inheritedPassword = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
  try {
    execFileSync(process.execPath, [cli, 'signer', 'generate', '--ci', '-p', 'test-only', '-w', key], { stdio: 'ignore' });
    const publicKey = fs.readFileSync(key + '.pub', 'utf8');
    fs.writeFileSync(binary, 'original release bytes');
    const signature = signArtifact(binary, key, 'test-only', '1.2.3', publicKey);
    // Actions provides the key in env; our explicit -f must not conflict with it.
    process.env.TAURI_SIGNING_PRIVATE_KEY = fs.readFileSync(key, 'utf8').trim();
    process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = 'test-only';
    const resigned = signArtifact(binary, key, 'test-only', '1.2.3', publicKey);
    assert.doesNotThrow(() => verifyArtifact(binary, resigned, publicKey));
    assert.doesNotThrow(() => verifyArtifact(binary, signature, publicKey));
    assert.throws(() => verifyArtifact(binary, '', publicKey));
    const appKey = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8')).plugins.updater.pubkey;
    assert.equal(appKey.trim(), fs.readFileSync('src-tauri/voicechat.key.pub', 'utf8').trim());
    assert.throws(() => verifyArtifact(binary, signature, appKey));
    fs.writeFileSync(binary, 'tampered release bytes');
    assert.throws(() => verifyArtifact(binary, signature, publicKey));
    assert.throws(() => signArtifact(binary, undefined, undefined, '1.2.3', publicKey));
    assert.throws(() => validateReleaseAssets({ platforms: {}, portable: {} }));
  } finally {
    if (inheritedKey === undefined) delete process.env.TAURI_SIGNING_PRIVATE_KEY;
    else process.env.TAURI_SIGNING_PRIVATE_KEY = inheritedKey;
    if (inheritedPassword === undefined) delete process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
    else process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = inheritedPassword;
    for (const file of [key, key + '.pub', binary, binary + '.sig']) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(dir);
  }
});
