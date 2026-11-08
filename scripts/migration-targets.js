export const productionMigrationTargets = Object.freeze({
  kind: 'production', frontend: '/var/www/voice-chat', backend: '/var/www/voice-chat-backend',
  releases: '/var/www/voice-chat-releases', shared: '/var/www/voice-chat-shared',
  backups: '/var/www/rvxis-migration-backups', state: '/opt/rvxis-migration',
  runtime: '/opt/rvxis-runtime', runtimeSource: '/opt/rvxis-migration-input/node-v22.22.0-linux-x64',
  pm2Home: '/root/.pm2', processName: 'voicechat-server', port: 3000, probePort: 3101,
  frontendUrl: 'https://rvxis.site/', frontendResolve: 'rvxis.site:443:127.0.0.1',
});

export function isolatedMigrationTargets(root) {
  if (!/^\/opt\/rvxis-migration-smoke\/run-[a-f0-9]{16}$/.test(root)) throw new Error('Invalid migration test root');
  return { kind: 'isolated', root, frontend: `${root}/frontend`, backend: `${root}/backend`,
    releases: `${root}/releases`, shared: `${root}/shared`, backups: `${root}/backups`, state: `${root}/state`,
    runtime: `${root}/runtime`, runtimeSource: `${root}/runtime-source`, pm2Home: `${root}/pm2`,
    processName: 'rvxis-migration-smoke', port: 3300, probePort: 3301,
    frontendUrl: 'http://127.0.0.1:3302/', frontendResolve: null };
}

export function validateMigrationTargets(targets) {
  const expected = targets.kind === 'production' ? productionMigrationTargets : isolatedMigrationTargets(targets.root);
  if (Object.keys(targets).sort().join() !== Object.keys(expected).sort().join() ||
      Object.entries(expected).some(([key, value]) => targets[key] !== value)) throw new Error('Migration target guard failed');
  return targets;
}
