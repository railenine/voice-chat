import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { isolatedMigrationTargets } from './migration-targets.js';
import { migrationPlan, applyMigration, rollbackMigration } from './migrate-legacy.js';

if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Run on the backend Linux VPS as root');
if (process.versions.node.split('.').map(Number)[0] < 22) throw new Error('Private Node22 is required');
process.umask(0o077);
const parent = '/opt/rvxis-migration-smoke';
fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
if (fs.realpathSync(parent) !== parent) throw new Error('Unexpected test parent symlink');
const lock = path.join(parent, '.active'); fs.mkdirSync(lock);
const session = path.join(parent, `session-${crypto.randomBytes(8).toString('hex')}`);
fs.mkdirSync(session, { mode: 0o700 });
const originalEnvironment = { ...process.env };
const checks = [];
const cleanEnvironment = { PATH: `${path.dirname(process.execPath)}:${originalEnvironment.PATH}`, LANG: 'C.UTF-8' };
let error, productionBefore, productionUnchanged = null, privatePm2Stopped = true;
async function productionSnapshot() {
  const r = await fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(2000) });
  const h = await r.json(); assert.equal(h.status, 'ok');
  const listeners = execFileSync('ss', ['-H', '-ltnp', 'sport = :3000'], { encoding: 'utf8' });
  const pids = [...listeners.matchAll(/pid=(\d+)/g)].map(match => Number(match[1])).sort();
  assert.ok(pids.length);
  return { pids, version: h.version, releaseId: h.releaseId ?? null,
    frontend: fs.realpathSync('/var/www/voice-chat'), backend: fs.realpathSync('/var/www/voice-chat-backend') };
}
const freePort = port => new Promise((resolve, reject) => {
  const server = net.createServer(); server.once('error', reject);
  server.listen(port, '127.0.0.1', () => server.close(resolve));
});
function pm2(config, args, extra = {}) {
  assert.match(config.pm2Home, /^\/opt\/rvxis-migration-smoke\/run-[a-f0-9]{16}\/pm2$/);
  const result = spawnSync('pm2', args, { env: { ...cleanEnvironment, PM2_HOME: config.pm2Home, ...extra },
    encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
  fs.appendFileSync(path.join(session, 'test.log'), `pm2 ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}\n`);
  assert.equal(result.status, 0, 'Isolated PM2 command failed; inspect the private test log');
  return result.stdout;
}
async function state(config) {
  const response = await fetch(`http://127.0.0.1:${config.port}/health`, { signal: AbortSignal.timeout(1000) });
  const data = await response.json();
  const proc = JSON.parse(pm2(config, ['jlist'])).find(item => item.name === config.processName);
  return { data, proc };
}
async function ready(config) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { const current = await state(config); if (current.data.status === 'ok') return current; } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Isolated legacy fixture did not become ready');
}
try {
  for (const port of [3300, 3301, 3302]) await freePort(port);
  productionBefore = await productionSnapshot();
  const disk = fs.statfsSync(parent);
  if (disk.bavail * disk.bsize < 2 * 1024 ** 3) throw new Error('At least 2GiB free is required for retained runtime fixtures');
  for (const scenario of ['success-and-explicit-rollback', 'probe', 'first-move', 'activation']) {
    const root = path.join(parent, `run-${crypto.randomBytes(8).toString('hex')}`);
    fs.mkdirSync(root, { mode: 0o700 });
    const config = isolatedMigrationTargets(root);
    process.env = { ...cleanEnvironment, PM2_HOME: config.pm2Home };
    for (const directory of [config.frontend, path.join(config.backend, 'server'), path.join(config.runtimeSource, 'bin'), config.pm2Home]) fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
    fs.writeFileSync(path.join(config.frontend, 'index.html'), 'unchanged legacy frontend');
    fs.chmodSync(config.frontend, 0o755);
    fs.chmodSync(path.join(config.frontend, 'index.html'), 0o644);
    fs.writeFileSync(path.join(config.backend, 'package.json'), JSON.stringify({ name: 'migration-fixture', version: '0.2.2', type: 'module' }));
    fs.writeFileSync(path.join(config.backend, '.env'), 'MIGRATION_FIXTURE_ONLY=not-a-real-secret\n', { mode: 0o644 });
    fs.chmodSync(path.join(config.backend, '.env'), 0o644);
    fs.copyFileSync(process.execPath, path.join(config.runtimeSource, 'bin/node'));
    fs.chmodSync(path.join(config.runtimeSource, 'bin/node'), 0o755);
    fs.writeFileSync(path.join(config.backend, 'server/index.js'), `
import http from 'node:http';
http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'ok',version:'0.2.2',sentinel:process.env.MIGRATION_SENTINEL}));}).listen(Number(process.env.PORT),process.env.HOST||'127.0.0.1');
`);
    const web = http.createServer((req, res) => {
      try { res.end(fs.readFileSync(path.join(config.frontend, 'index.html'))); } catch { res.writeHead(503).end(); }
    });
    await new Promise(resolve => web.listen(3302, '127.0.0.1', resolve));
    let used = false;
    try {
      used = true;
      pm2(config, ['start', path.join(config.backend, 'server/index.js'), '--cwd', config.backend,
        '--name', config.processName, '--interpreter', process.execPath], { PORT: '3300', HOST: '127.0.0.1', MIGRATION_SENTINEL: 'must-survive' });
      const before = await ready(config);
      const plan = await migrationPlan(config);
      assert.equal(before.proc.pid, (await state(config)).proc.pid);
      assert.equal(fs.existsSync(config.state), false, 'Plan must not create migration state');
      assert.equal(fs.existsSync(config.runtime), false, 'Plan must not provision a runtime');
      if (scenario === 'success-and-explicit-rollback') {
        const result = await applyMigration(config, plan.id);
        assert.equal(result.passed, true);
        assert.ok(fs.lstatSync(config.frontend).isSymbolicLink());
        assert.ok(fs.lstatSync(config.backend).isSymbolicLink());
        assert.equal(fs.statSync(path.join(config.shared, '.env')).mode & 0o777, 0o600);
        assert.equal(fs.statSync(config.backups).mode & 0o777, 0o700);
        assert.equal(fs.statSync(config.releases).mode & 0o777, 0o755);
        assert.equal(fs.statSync(path.join(config.frontend, 'index.html')).mode & 0o777, 0o644);
        const active = await state(config);
        assert.equal(active.data.sentinel, 'must-survive');
        assert.equal(active.proc.pm2_env.exec_interpreter, result.interpreter);
        assert.equal(fs.realpathSync(`/proc/${active.proc.pid}/exe`), fs.realpathSync(result.interpreter));
        await rollbackMigration(config, result.id);
        const restored = await ready(config);
        await rollbackMigration(config, result.id);
        assert.equal((await state(config)).proc.pid, restored.proc.pid, 'Repeated rollback must not restart a restored service');
      } else {
        await assert.rejects(applyMigration(config, plan.id, scenario), /Migration failed; phase=/);
        if (scenario === 'probe') assert.equal((await state(config)).proc.pid, before.proc.pid, 'Failed probe must not restart legacy');
      }
      assert.equal(fs.lstatSync(config.frontend).isSymbolicLink(), false);
      assert.equal(fs.lstatSync(config.backend).isSymbolicLink(), false);
      const restored = await ready(config);
      assert.equal(restored.data.version, '0.2.2'); assert.equal(restored.data.sentinel, 'must-survive');
      assert.equal(fs.realpathSync(`/proc/${restored.proc.pid}/exe`), plan.summary.oldNode);
      assert.equal(fs.statSync(path.join(config.backend, '.env')).mode & 0o777, 0o644);
      checks.push({ scenario, passed: true, privateRoot: root });
    } finally {
      try { if (used) pm2(config, ['kill']); }
      catch (failure) { privatePm2Stopped = false; throw failure; }
      finally { web.closeAllConnections(); await new Promise(resolve => web.close(resolve)); }
      for (let attempt = 0; attempt < 10; attempt++) {
        try { for (const port of [3300, 3301, 3302]) await freePort(port); break; }
        catch (failure) { if (attempt === 9) throw failure; await new Promise(resolve => setTimeout(resolve, 200)); }
      }
    }
  }
} catch (failure) { error = failure; }
finally {
  process.env = originalEnvironment;
  if (productionBefore) {
    try { assert.deepEqual(await productionSnapshot(), productionBefore); productionUnchanged = true; }
    catch (failure) { productionUnchanged = false; error ||= failure; }
  }
  fs.rmdirSync(lock);
}
const report = { session, checks, productionPidAndPathsUnchanged: productionUnchanged,
  isolatedPm2Stopped: privatePm2Stopped, passed: !error && productionUnchanged === true && privatePm2Stopped };
fs.writeFileSync(path.join(session, 'result.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (error) throw error;
