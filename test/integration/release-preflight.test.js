import assert from 'node:assert/strict';
import { it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

it('prepares versions without reusing binary metadata and refuses unsafe push before mutation', () => {
  const scratchRoot = path.resolve('.test-tmp');
  fs.mkdirSync(scratchRoot, { recursive: true });
  const dir = fs.mkdtempSync(path.join(scratchRoot, 'rvxis-release-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts')); fs.mkdirSync(path.join(dir, 'src/utils'), { recursive: true });
    for (const file of ['scripts/bump-version.js', 'scripts/generate-latest-json.js', 'scripts/release-security.js', 'src/utils/semver.ts']) {
      fs.copyFileSync(file, path.join(dir, file));
    }
    const pkg = { type: 'module', version: '0.2.2' };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
    fs.mkdirSync(path.join(dir, 'src-tauri'));
    fs.writeFileSync(path.join(dir, 'src-tauri/Cargo.lock'), 'version = 4\n\n[[package]]\nname = "voice-chat"\nversion = "0.2.2"\n');
    const asset = { url: 'https://example.test/old', signature: 'old-signature', sha256: 'a'.repeat(64), size: 10 };
    fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify({ version: '0.2.2', platforms: { 'windows-x86_64': asset }, portable: { 'windows-x86_64': asset } }));
    const gitDir = path.join(dir, 'metadata');
    const env = { ...process.env, GIT_DIR: gitDir, GIT_WORK_TREE: dir };
    execFileSync('git', ['init', '-b', 'fix/test'], { cwd: dir, env });
    const run = (...args) => spawnSync(process.execPath, ['scripts/bump-version.js', ...args], { cwd: dir, encoding: 'utf8', env });
    const denied = run('0.2.3', '--push');
    assert.notEqual(denied.status, 0); assert.match(denied.stderr, /clean main branch/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).version, '0.2.2');
    assert.notEqual(run('0.2.1').status, 0);
    const prepared = run('0.2.3'); assert.equal(prepared.status, 0, prepared.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'latest.json')));
    assert.equal(manifest.version, '0.2.3');
    assert.match(fs.readFileSync(path.join(dir, 'src-tauri/Cargo.lock'), 'utf8'), /name = "voice-chat"\nversion = "0.2.3"/);
    for (const value of [manifest.platforms['windows-x86_64'], manifest.portable['windows-x86_64']]) {
      assert.equal(value.signature, undefined); assert.equal(value.sha256, undefined); assert.equal(value.size, undefined);
    }
  } finally {
    if (path.dirname(dir) !== scratchRoot || !path.basename(dir).startsWith('rvxis-release-test-')) throw Error('Unsafe temporary directory');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
