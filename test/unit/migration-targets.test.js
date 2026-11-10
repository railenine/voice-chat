import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isolatedMigrationTargets, productionMigrationTargets, validateMigrationTargets } from '../../scripts/migration-targets.js';

test('migration target isolation rejects mixed production paths, process names and ports', () => {
  const targets = isolatedMigrationTargets('/opt/rvxis-migration-smoke/run-0123456789abcdef');
  assert.equal(validateMigrationTargets(targets), targets);
  for (const [key, value] of [['backend', '/var/www/voice-chat-backend'], ['pm2Home', '/root/.pm2'],
    ['processName', 'voicechat-server'], ['port', 3000], ['frontendUrl', 'https://rvxis.site/']]) {
    assert.throws(() => validateMigrationTargets({ ...targets, [key]: value }));
  }
  for (const root of ['/opt/rvxis-migration-smoke/run-0123456789abcdef/..', '/var/www', '/opt/rvxis-migration-smoke/run-xyz']) {
    assert.throws(() => isolatedMigrationTargets(root));
  }
  assert.throws(() => validateMigrationTargets({ ...targets, extra: true }));
  assert.equal(validateMigrationTargets(productionMigrationTargets), productionMigrationTargets);
  assert.throws(() => validateMigrationTargets({ ...productionMigrationTargets, runtimeSource: '/tmp/untrusted' }));
});
