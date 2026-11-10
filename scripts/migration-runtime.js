import fs from 'node:fs';
import path from 'node:path';
import { validateMigrationTargets } from './migration-targets.js';

// Normalize only the newly created fixture file. copyFile on Linux can preserve
// an archive owner's UID even when root performs the copy.
export function prepareIsolatedRuntimeBinary(source, config) {
  validateMigrationTargets(config);
  if (config.kind !== 'isolated' || process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Root-owned isolated runtime preparation only');
  if (fs.realpathSync(config.root) !== config.root) throw new Error('Unexpected fixture root');
  const bin = path.join(config.runtimeSource, 'bin');
  if (fs.realpathSync(bin) !== bin) throw new Error('Unexpected runtime directory symlink');
  const target = path.join(bin, 'node');
  if (fs.lstatSync(target, { throwIfNoEntry: false })) throw new Error('Fixture runtime already exists');
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  fs.chownSync(target, 0, 0);
  fs.chmodSync(target, 0o755);
}
