import assert from 'node:assert/strict';
import { it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';

it('Windows extraction rejects traversal, duplicates, missing and extra files before writing', { skip: process.platform !== 'win32' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvxis-archive-test-'));
  try {
    const allowed = path.join(root, 'allowed.json'); fs.writeFileSync(allowed, JSON.stringify(['nested/good.txt']));
    for (const mode of ['valid', 'traversal', 'duplicate', 'extra', 'missing']) {
      const archive = path.join(root, `${mode}.zip`), destination = path.join(root, mode);
      execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', `
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $names = switch($env:ZIP_TEST_MODE) {
          valid { @('nested/good.txt') }
          traversal { @('../escape.txt') }
          duplicate { @('nested/good.txt','nested/good.txt') }
          extra { @('nested/good.txt','evil.txt') }
          missing { @() }
        }
        $zip = [IO.Compression.ZipFile]::Open($env:ZIP_TEST_FILE,[IO.Compression.ZipArchiveMode]::Create)
        try { foreach($name in $names) {
          $entry=$zip.CreateEntry($name); $writer=[IO.StreamWriter]::new($entry.Open())
          try { $writer.Write('fixture') } finally { $writer.Dispose() }
        } } finally { $zip.Dispose() }
      `], { env: { ...process.env, ZIP_TEST_FILE: archive, ZIP_TEST_MODE: mode }, stdio: 'ignore' });
      const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', path.resolve('scripts/expand-release-candidate.ps1'),
        '-Archive', archive, '-Destination', destination, '-ExpectedFiles', allowed], { encoding: 'utf8' });
      if (mode === 'valid') {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(fs.readFileSync(path.join(destination, 'nested/good.txt'), 'utf8'), 'fixture');
      } else {
        assert.notEqual(result.status, 0);
        assert.equal(fs.existsSync(destination), false, 'Rejected ZIP must not create the destination');
        assert.equal(fs.existsSync(path.join(root, 'escape.txt')), false);
      }
    }
  } finally {
    assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('rvxis-archive-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
