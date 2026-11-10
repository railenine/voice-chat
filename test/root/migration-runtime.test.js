import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isolatedMigrationTargets, productionMigrationTargets } from '../../scripts/migration-targets.js';
import { prepareIsolatedRuntimeBinary } from '../../scripts/migration-runtime.js';

test('runtime preparation creates a root-owned copy without changing an archive-owned source', () => {
  assert.equal(process.platform, 'linux');
  assert.equal(process.getuid(), 0, 'Run this regression with sudo, outside the ordinary cross-platform tests');
  const parent = '/opt/rvxis-migration-smoke';
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  assert.equal(fs.realpathSync(parent), parent);
  const root = path.join(parent, `run-${crypto.randomBytes(8).toString('hex')}`);
  fs.mkdirSync(root, { mode: 0o700 });
  const config = isolatedMigrationTargets(root);
  const bin = path.join(config.runtimeSource, 'bin');
  fs.mkdirSync(bin, { recursive: true, mode: 0o700 });
  const source = path.join(root, 'archive-owned-node');
  const target = path.join(bin, 'node');
  try {
    fs.writeFileSync(source, 'fake runtime fixture bytes', { mode: 0o755 });
    fs.chownSync(source, 65534, 65534);
    prepareIsolatedRuntimeBinary(source, config);
    assert.equal(fs.statSync(target).uid, 0);
    assert.equal(fs.statSync(target).gid, 0);
    assert.equal(fs.statSync(target).mode & 0o777, 0o755);
    assert.deepEqual(fs.readFileSync(target), fs.readFileSync(source));
    assert.equal(fs.statSync(source).uid, 65534);
    assert.throws(() => prepareIsolatedRuntimeBinary(source, config), /already exists/);
    assert.throws(() => prepareIsolatedRuntimeBinary(source, productionMigrationTargets), /isolated/);
  } finally {
    for (const file of [source, target]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(bin); fs.rmdirSync(config.runtimeSource); fs.rmdirSync(root);
  }
});
