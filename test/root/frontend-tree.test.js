import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { copyFrontendTree } from '../../scripts/frontend-tree.js';

test('copied frontend remains readable by nginx-like user under umask077', () => {
  assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 0);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvxis-public-copy-'));
  const previous = process.umask(0o077);
  try {
    fs.chmodSync(root, 0o755);
    const source = path.join(root, 'source'), target = path.join(root, 'target');
    fs.mkdirSync(path.join(source, 'assets/nested'), { recursive: true });
    for (const dir of [source, path.join(source, 'assets'), path.join(source, 'assets/nested')]) fs.chmodSync(dir, 0o755);
    const relative = 'assets/nested/app.js';
    fs.writeFileSync(path.join(source, relative), 'public application bytes');
    fs.chmodSync(path.join(source, relative), 0o644);
    copyFrontendTree(source, target);
    assert.equal(fs.statSync(path.join(target, 'assets')).mode & 0o777, 0o755);
    assert.equal(fs.statSync(path.join(target, 'assets/nested')).mode & 0o777, 0o755);
    const result = spawnSync(process.execPath, ['-e', 'process.stdout.write(require("fs").readFileSync(process.argv[1]))', path.join(target, relative)],
      { uid: 65534, gid: 65534, env: {}, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, 'public application bytes');
  } finally {
    process.umask(previous);
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    fs.rmSync(root, { recursive: true });
  }
});
