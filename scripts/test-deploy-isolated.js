import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { isolateDeploymentScript } from './deploy-isolation.js';

if (process.platform !== 'linux') throw new Error('Run this isolated test on the backend Linux VPS.');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 22)) throw new Error('Node 22.22+ is required.');
process.umask(0o077);
const parent = '/opt/rvxis-deploy-smoke';
if (fs.realpathSync('/opt') !== '/opt') throw new Error('Unexpected /opt path');
fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
if (fs.realpathSync(parent) !== parent) throw new Error('Test parent must not be a symlink');
const lock = path.join(parent, '.active');
fs.mkdirSync(lock); // Atomic exclusion: a previous/parallel run must be inspected.
const root = path.join(parent, `run-${crypto.randomBytes(8).toString('hex')}`);
let env, daemonUsed = false, error, cleaned = false;
const checks = [];
const report = { root, node: process.version, checks };

const freePort = port => new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.once('error', reject);
  socket.listen(port, '127.0.0.1', () => socket.close(resolve));
});
async function health(port) {
  const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw new Error('Health check failed');
  return response.json();
}
async function productionSnapshot() {
  const current = await health(3000);
  if (current.status !== 'ok') throw new Error('Working backend must be healthy before/after the test');
  const listeners = execFileSync('ss', ['-H', '-lntp', 'sport = :3000'], { encoding: 'utf8' });
  const pids = [...listeners.matchAll(/pid=(\d+)/g)].map(match => Number(match[1])).sort();
  if (!pids.length) throw new Error('Cannot identify the working backend process');
  return { pids, status: current.status, version: current.version, releaseId: current.releaseId ?? null,
    frontend: fs.realpathSync('/var/www/voice-chat'), backend: fs.realpathSync('/var/www/voice-chat-backend') };
}
function command(binary, args, extraEnv = {}) {
  if (env.PM2_HOME !== path.join(root, 'pm2') || fs.realpathSync(root) !== root) throw new Error('Isolation guard failed');
  const result = spawnSync(binary, args, { env: { ...env, ...extraEnv }, cwd: root,
    encoding: 'utf8', timeout: 90000, maxBuffer: 2 * 1024 * 1024 });
  const output = `${result.stdout || ''}\n${result.stderr || ''}\n${result.error?.message || ''}`;
  fs.appendFileSync(path.join(root, 'test.log'), `${binary} ${args.join(' ')}\n${output}\n`);
  return { status: result.status, output };
}
function fixture(id, mode, version) {
  const directory = path.join(root, 'releases', id);
  fs.mkdirSync(path.join(directory, 'server'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'dist'));
  const pkg = { name: 'rvxis-deploy-smoke-fixture', version, private: true, type: 'module' };
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(pkg));
  fs.writeFileSync(path.join(directory, 'package-lock.json'), JSON.stringify({ name: pkg.name, version,
    lockfileVersion: 3, requires: true, packages: { '': { name: pkg.name, version } } }));
  fs.writeFileSync(path.join(directory, 'dist/index.html'), `fixture ${id}`);
  fs.writeFileSync(path.join(directory, 'server/index.js'), `
import http from 'node:http';
const mode=${JSON.stringify(mode)}, version=${JSON.stringify(version)};
const port=Number(process.env.PORT);
if (mode==='probe-fail' || (mode==='activation-fail' && port===3200)) process.exit(42);
http.createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({status:'ok',version,node:process.version,
    ...(mode==='legacy'?{}:{releaseId:process.env.RVXIS_RELEASE})}));
}).listen(port,process.env.HOST || '127.0.0.1');
`);
  return directory;
}
async function expectRelease(id, version, legacy = false) {
  assert.equal(fs.realpathSync(path.join(root, 'frontend')), path.join(root, 'releases', id, 'dist'));
  assert.equal(fs.realpathSync(path.join(root, 'backend')), path.join(root, 'releases', id));
  for (let i = 0; i < 20; i++) {
    try {
      const current = await health(3200);
      assert.equal(current.status, 'ok'); assert.equal(current.version, version);
      assert.equal(current.releaseId ?? null, legacy ? null : id);
      assert.equal(current.node, process.version);
      return;
    } catch (failure) { if (i === 19) throw failure; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
function deploy(id, expectedSuccess, marker) {
  const result = command('bash', [path.join(root, 'deploy-under-test.sh')], { RVXIS_RELEASE: id });
  assert.equal(result.status === 0, expectedSuccess);
  assert.ok(result.output.includes(marker), 'Deployment did not reach the expected path; inspect test.log');
}

try {
  await freePort(3200); await freePort(3201);
  const before = await productionSnapshot();
  fs.mkdirSync(root, { mode: 0o700 });
  if (fs.realpathSync(root) !== root) throw new Error('Test root must not be a symlink');
  fs.mkdirSync(path.join(root, 'shared'));
  fs.mkdirSync(path.join(root, 'pm2'));
  fs.writeFileSync(path.join(root, 'shared/.env'), 'DEPLOYMENT_FIXTURE_ONLY=1\n');
  const script = isolateDeploymentScript(fs.readFileSync(new URL('./deploy-candidate.sh', import.meta.url), 'utf8'), root);
  fs.writeFileSync(path.join(root, 'deploy-under-test.sh'), script);
  const pathKey = Object.keys(process.env).find(key => key.toLowerCase() === 'path') || 'PATH';
  // Do not persist inherited account secrets in the fixture PM2 dump/logs.
  env = { [pathKey]: `${path.dirname(process.execPath)}:${process.env[pathKey] || ''}`, LANG: 'C.UTF-8',
    PM2_HOME: path.join(root, 'pm2'), NPM_CONFIG_CACHE: path.join(root, 'npm-cache'),
    NPM_CONFIG_USERCONFIG: '/dev/null', NPM_CONFIG_GLOBALCONFIG: path.join(root, 'npm-global.conf'),
    NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false', NPM_CONFIG_UPDATE_NOTIFIER: 'false' };
  const initial = '0'.repeat(40), good = 'a'.repeat(40), badProbe = 'b'.repeat(40), badActivation = 'c'.repeat(40);
  const legacy = fixture(initial, 'legacy', '0.2.2');
  fixture(good, 'good', '0.2.3'); fixture(badProbe, 'probe-fail', '0.2.4'); fixture(badActivation, 'activation-fail', '0.2.4');
  fs.symlinkSync(path.join(legacy, 'dist'), path.join(root, 'frontend'));
  fs.symlinkSync(legacy, path.join(root, 'backend'));
  daemonUsed = true;
  const started = command('pm2', ['start', path.join(legacy, 'server/index.js'), '--cwd', legacy,
    '--name', 'rvxis-deploy-smoke', '--interpreter', process.execPath],
  { HOST: '127.0.0.1', PORT: '3200', RVXIS_RELEASE: initial });
  assert.equal(started.status, 0);
  await expectRelease(initial, '0.2.2', true);

  console.log('[Delivery test] Rollback to a legacy version without releaseId');
  deploy(badActivation, false, 'Activation failed; previous release restored');
  await expectRelease(initial, '0.2.2', true);
  checks.push({ case: 'legacy-rollback', passed: true });
  console.log('[Delivery test] Successful candidate activation');
  deploy(good, true, 'Release activated and health checked');
  await expectRelease(good, '0.2.3'); checks.push({ case: 'activation', passed: true });
  console.log('[Delivery test] Broken candidate leaves active version running');
  deploy(badProbe, false, 'Candidate health check failed');
  await expectRelease(good, '0.2.3'); checks.push({ case: 'candidate-rejection', passed: true });
  console.log('[Delivery test] Failed activation restores links and service');
  deploy(badActivation, false, 'Activation failed; previous release restored');
  await expectRelease(good, '0.2.3'); checks.push({ case: 'activation-rollback', passed: true });
  assert.deepEqual(await productionSnapshot(), before);
  report.productionPidAndPathsUnchanged = true;
} catch (failure) {
  error = failure.message;
} finally {
  try {
    if (env && daemonUsed) {
      const result = command('pm2', ['kill']);
      cleaned = result.status === 0;
    } else cleaned = true;
  } catch { cleaned = false; }
  let portsFree = false;
  for (let i = 0; i < 20; i++) {
    try { await freePort(3200); await freePort(3201); portsFree = true; break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  cleaned = cleaned && portsFree;
  fs.rmdirSync(lock);
}
report.isolatedPm2Stopped = cleaned;
report.passed = !error && cleaned && checks.length === 4;
if (error) report.error = error;
console.log(JSON.stringify(report, null, 2));
if (fs.existsSync(root)) fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
