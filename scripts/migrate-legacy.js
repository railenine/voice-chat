import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { productionMigrationTargets, validateMigrationTargets } from './migration-targets.js';

const exists = file => Boolean(fs.lstatSync(file, { throwIfNoEntry: false }));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function privateJson(file, data) {
  const temporary = `${file}.${crypto.randomBytes(4).toString('hex')}.next`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}
function canonical(file) {
  const resolved = fs.realpathSync(file);
  if (resolved !== file) throw new Error(`Unexpected symlink in ${file}`);
  return resolved;
}
function command(config, binary, args, env = process.env) {
  const result = spawnSync(binary, args, { env: { ...env, PM2_HOME: config.pm2Home }, encoding: 'utf8',
    timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  // PM2 output/environment can contain credentials. Never echo it on failure.
  if (result.status !== 0) throw new Error(`Migration command failed: ${path.basename(binary)}`);
  return result.stdout;
}
function processInfo(config) {
  if (process.env.PM2_HOME && process.env.PM2_HOME !== config.pm2Home) throw new Error('Unexpected PM2_HOME');
  const daemonPid = Number(fs.readFileSync(path.join(config.pm2Home, 'pm2.pid'), 'utf8'));
  if (!Number.isInteger(daemonPid) || daemonPid <= 1) throw new Error('Existing PM2 daemon required');
  process.kill(daemonPid, 0);
  let list;
  try { list = JSON.parse(command(config, 'pm2', ['jlist'])); }
  catch { throw new Error('Cannot read existing PM2 process list'); }
  const matches = list.filter(item => item.name === config.processName);
  if (matches.length !== 1) throw new Error('Expected exactly one target PM2 process');
  return matches[0];
}
async function health(port) {
  const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
  const data = await response.json();
  if (!response.ok || data.status !== 'ok') throw new Error('Backend health failed');
  return data;
}
async function frontendHash(config) {
  const args = ['--fail', '--silent', '--show-error', '--max-time', '5', '--noproxy', '*'];
  if (config.frontendResolve) args.push('--resolve', config.frontendResolve);
  args.push(config.frontendUrl);
  return new Promise((resolve, reject) => {
    const child = spawn('curl', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks = [];
    let size = 0, oversized = false;
    const deadline = setTimeout(() => child.kill('SIGKILL'), 7000);
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) { oversized = true; child.kill('SIGKILL'); }
      else chunks.push(chunk);
    });
    child.once('error', () => { clearTimeout(deadline); reject(new Error('Frontend HTTP/TLS check failed')); });
    child.once('close', code => {
      clearTimeout(deadline);
      if (code !== 0 || oversized) reject(new Error('Frontend HTTP/TLS check failed'));
      else resolve(hash(Buffer.concat(chunks)));
    });
  });
}
function ensureHost(config) {
  validateMigrationTargets(config);
  if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Run on the Linux server as root');
  if (config.kind === 'isolated') canonical(config.root);
  else { canonical('/var/www'); canonical('/opt'); }
  canonical(config.pm2Home);
}
export async function migrationPlan(config = productionMigrationTargets) {
  ensureHost(config);
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 22)) throw new Error('Run the migration tool using Node 22.22+');
  for (const directory of [config.frontend, config.backend, config.runtimeSource]) {
    canonical(directory);
    if (!fs.lstatSync(directory).isDirectory()) throw new Error('Legacy directories required');
  }
  for (const directory of [config.releases, config.shared, config.backups, config.state, config.runtime]) {
    if (exists(directory)) throw new Error(`Migration destination already exists; inspect previous state: ${directory}`);
    canonical(path.dirname(directory));
  }
  const envFile = path.join(config.backend, '.env');
  if (!fs.lstatSync(envFile).isFile()) throw new Error('A regular legacy .env is required');
  if (exists(path.join(config.backend, 'dist'))) throw new Error('Legacy backend already has dist; review before migration');
  for (const file of [path.join(config.frontend, 'index.html'), path.join(config.backend, 'package.json'),
    path.join(config.backend, 'server/index.js')]) if (!fs.statSync(file).isFile()) throw new Error('Legacy application is incomplete');
  const proc = processInfo(config), settings = proc.pm2_env;
  if (settings.status !== 'online' || settings.exec_mode !== 'fork_mode' || settings.watch ||
      settings.args?.length || settings.node_args?.length || settings.pm_cwd !== config.backend ||
      settings.pm_exec_path !== path.join(config.backend, 'server/index.js')) throw new Error('PM2 configuration changed; review before migration');
  if (fs.statSync(`/proc/${proc.pid}`).uid !== 0) throw new Error('This migration expects a root-owned backend process');
  const oldNode = fs.realpathSync(`/proc/${proc.pid}/exe`);
  if (!fs.statSync(oldNode).isFile()) throw new Error('Original interpreter must remain available');
  const node = path.join(config.runtimeSource, 'bin/node');
  if (fs.lstatSync(node).uid !== 0 || (fs.statSync(node).mode & 0o022)) throw new Error('Runtime must be root-owned and not writable by other users');
  const nodeVersion = execFileSync(node, ['--version'], { encoding: 'utf8' }).trim();
  if (nodeVersion !== 'v22.22.0') throw new Error('Expected the separately verified Node v22.22.0');
  const baseline = await health(config.port);
  const version = JSON.parse(fs.readFileSync(path.join(config.backend, 'package.json'), 'utf8')).version;
  if (baseline.version !== version) throw new Error('Running version differs from on-disk backend');
  const frontendSha = hash(fs.readFileSync(path.join(config.frontend, 'index.html')));
  if (await frontendHash(config) !== frontendSha) throw new Error('Frontend route differs from the expected document root');
  const listener = command(config, 'ss', ['-H', '-ltn', `sport = :${config.probePort}`]).trim();
  if (listener) throw new Error('Candidate probe port is occupied');
  const stats = [config.frontend, config.backend, envFile].map(file => {
    const s = fs.lstatSync(file);
    if (s.uid !== 0) throw new Error('Legacy paths must be root-owned');
    return { path: file, device: s.dev, inode: s.ino, mtimeMs: s.mtimeMs, mode: s.mode & 0o777 };
  });
  if (stats.some(s => s.device !== fs.statSync(path.dirname(config.frontend)).dev)) throw new Error('Expected same filesystem for directory moves');
  const summary = { mode: 'plan-only', processName: config.processName, pid: proc.pid, pmId: proc.pm_id,
    version, oldNode, targetNodeVersion: nodeVersion, frontendSha, paths: stats,
    runtimeDestination: config.runtime, legacyReleaseRoot: config.releases, sharedEnvMode: '0600',
    willRestartBackend: true, willChangeApplicationCode: false };
  return { summary, id: hash(JSON.stringify(summary)), proc, config };
}
function journal(state) { privateJson(path.join(state.directory, 'state.json'), state); }
function phase(state, name) { state.phase = name; journal(state); }
function ownLink(link, target) {
  if (!exists(link)) return;
  const stat = fs.lstatSync(link);
  if (!stat.isSymbolicLink() || fs.readlinkSync(link) !== target) throw new Error(`Refusing to remove an unexpected path: ${link}`);
  fs.unlinkSync(link);
}
function stopTarget(config, pmId) {
  const proc = processInfo(config);
  if (proc.pm_id !== pmId) throw new Error('Target PM2 record changed');
  if (!['stopped', 'errored'].includes(proc.pm2_env.status)) command(config, 'pm2', ['stop', String(pmId)]);
}
async function waitBackend(config, expected, interpreter) {
  for (let i = 0; i < 30; i++) {
    try {
      const current = await health(config.port), proc = processInfo(config);
      if (current.version === expected && fs.realpathSync(`/proc/${proc.pid}/exe`) === interpreter) return;
    } catch { /* Give the target process time to become healthy. */ }
    await sleep(500);
  }
  throw new Error('Backend did not become healthy with the expected interpreter');
}
async function restore(config, state) {
  if (state.configDigest !== hash(JSON.stringify(config))) throw new Error('Rollback target configuration mismatch');
  if (state.phase === 'rolled-back') {
    for (const file of [config.frontend, config.backend]) canonical(file);
    await waitBackend(config, state.version, state.oldNode);
    return;
  }
  const frontendBackup = path.join(state.backup, 'frontend'), backendBackup = path.join(state.backup, 'backend');
  const moved = exists(frontendBackup) || exists(backendBackup);
  if (!moved && !state.stopped) {
    // Preflight/probe failure: leave the original live process completely alone.
    state.phase = 'failed-before-switch'; journal(state); return;
  }
  phase(state, 'restoring');
  stopTarget(config, state.pmId);
  for (const [link, backup, target] of [[config.frontend, frontendBackup, path.join(state.legacy, 'dist')],
    [config.backend, backendBackup, state.legacy]]) {
    if (exists(backup)) {
      ownLink(link, target);
      fs.renameSync(backup, link);
    } else if (!exists(link) || !fs.lstatSync(link).isDirectory() || fs.lstatSync(link).isSymbolicLink()) {
      throw new Error('Original directory is missing; manual recovery required');
    }
  }
  command(config, 'pm2', ['restart', String(state.pmId), '--interpreter', state.oldNode]);
  await waitBackend(config, state.version, state.oldNode);
  if (await frontendHash(config) !== state.frontendSha) throw new Error('Restored frontend verification failed');
  command(config, 'pm2', ['save']);
  phase(state, 'rolled-back');
}
export async function applyMigration(config, approvedPlanId, testFault) {
  if (testFault && config.kind !== 'isolated') throw new Error('Fault injection is isolated-test only');
  const plan = await migrationPlan(config);
  if (approvedPlanId !== plan.id) throw new Error('Plan changed; run --plan and review it again');
  process.umask(0o077);
  fs.mkdirSync(config.state, { mode: 0o700 });
  const lock = path.join(config.state, '.active'); fs.mkdirSync(lock);
  privateJson(path.join(lock, 'owner.json'), { pid: process.pid });
  const id = crypto.randomBytes(8).toString('hex');
  const directory = path.join(config.state, id); fs.mkdirSync(directory, { mode: 0o700 });
  const state = { id, directory, configDigest: hash(JSON.stringify(config)), pmId: plan.proc.pm_id,
    oldNode: plan.summary.oldNode, version: plan.summary.version, frontendSha: plan.summary.frontendSha,
    legacy: path.join(config.releases, `legacy-${id}`), backup: path.join(config.backups, id), stopped: false, phase: 'preparing' };
  journal(state);
  // Contains service environment: root-only, never printed or copied off-server.
  privateJson(path.join(directory, 'pm2-before.json'), plan.proc);
  let aborted = false, probe, probeError = false;
  const abort = () => { aborted = true; };
  process.on('SIGINT', abort); process.on('SIGTERM', abort);
  const checkAbort = () => { if (aborted) throw new Error('Migration interrupted'); };
  try {
    for (const [folder, mode] of [[config.releases, 0o755], [config.shared, 0o700], [config.backups, 0o700], [config.runtime, 0o755]]) {
      fs.mkdirSync(folder, { mode }); fs.chmodSync(folder, mode);
    }
    fs.mkdirSync(state.backup, { mode: 0o700 });
    const runtime = path.join(config.runtime, 'node-v22.22.0');
    fs.cpSync(config.runtimeSource, runtime, { recursive: true, dereference: false, force: false, errorOnExist: true });
    fs.chmodSync(runtime, 0o755);
    const node = path.join(runtime, 'bin/node');
    if (hash(fs.readFileSync(node)) !== hash(fs.readFileSync(path.join(config.runtimeSource, 'bin/node')))) throw new Error('Runtime copy differs');
    fs.symlinkSync(runtime, path.join(config.runtime, 'current'));
    fs.cpSync(config.backend, state.legacy, { recursive: true, dereference: false, force: false, errorOnExist: true,
      filter: file => file !== path.join(config.backend, '.env') });
    fs.chmodSync(state.legacy, 0o755);
    fs.cpSync(config.frontend, path.join(state.legacy, 'dist'), { recursive: true, dereference: false, force: false, errorOnExist: true });
    fs.chmodSync(path.join(state.legacy, 'dist'), 0o755);
    const sharedEnv = path.join(config.shared, '.env');
    fs.copyFileSync(path.join(config.backend, '.env'), sharedEnv, fs.constants.COPYFILE_EXCL); fs.chmodSync(sharedEnv, 0o600);
    fs.symlinkSync(sharedEnv, path.join(state.legacy, '.env'));
    phase(state, 'probing-legacy-copy'); checkAbort();
    const log = fs.openSync(path.join(directory, 'probe.log'), 'wx', 0o600);
    const inherited = Object.fromEntries(Object.entries(plan.proc.pm2_env.env || {}).filter(([, value]) => typeof value === 'string'));
    probe = spawn(node, [path.join(state.legacy, 'server/index.js')], { cwd: state.legacy,
      env: { ...inherited, PATH: `${runtime}/bin:/usr/bin:/bin`, NODE_ENV: 'production', PORT: String(config.probePort), HOST: '127.0.0.1' },
      stdio: ['ignore', log, log] }); fs.closeSync(log);
    probe.once('error', () => { probeError = true; });
    let ready = false;
    for (let i = 0; i < 30; i++) {
      checkAbort();
      if (probeError || probe.exitCode !== null) break;
      try { if ((await health(config.probePort)).version === state.version) { ready = true; break; } } catch { /* not yet ready */ }
      await sleep(300);
    }
    await stopProbe(probe); probe = null;
    if (!ready || testFault === 'probe') throw new Error('Legacy Node22 probe failed');
    // Recheck identities immediately before the maintenance window.
    for (const item of plan.summary.paths) {
      const current = fs.lstatSync(item.path);
      if (current.ino !== item.inode || current.dev !== item.device || current.mtimeMs !== item.mtimeMs) throw new Error('Legacy paths changed during preparation');
    }
    if (processInfo(config).pid !== plan.proc.pid) throw new Error('PM2 process changed during preparation');
    checkAbort(); phase(state, 'stopping-legacy'); state.stopped = true; journal(state);
    stopTarget(config, state.pmId);
    checkAbort(); phase(state, 'switching-directories');
    fs.renameSync(config.frontend, path.join(state.backup, 'frontend'));
    if (testFault === 'first-move') throw new Error('Injected first directory move failure');
    fs.symlinkSync(path.join(state.legacy, 'dist'), config.frontend);
    fs.renameSync(config.backend, path.join(state.backup, 'backend'));
    fs.symlinkSync(state.legacy, config.backend);
    checkAbort(); phase(state, 'starting-node22');
    command(config, 'pm2', ['restart', String(state.pmId), '--interpreter', node]);
    if (testFault === 'activation') throw new Error('Injected activation failure');
    await waitBackend(config, state.version, fs.realpathSync(node)); checkAbort();
    if (await frontendHash(config) !== state.frontendSha) throw new Error('Migrated frontend verification failed');
    command(config, 'pm2', ['save']); phase(state, 'complete');
    return { passed: true, id, version: state.version, stateDirectory: directory, interpreter: node, applicationCodeChanged: false };
  } catch (error) {
    if (probe) await stopProbe(probe);
    try { await restore(config, state); }
    catch { throw new Error(`Migration failed and automatic recovery needs inspection. Private state: ${directory}`); }
    throw new Error(`Migration failed; phase=${state.phase}. Private state retained: ${directory}`);
  } finally {
    process.off('SIGINT', abort); process.off('SIGTERM', abort);
    fs.unlinkSync(path.join(lock, 'owner.json')); fs.rmdirSync(lock);
  }
}
async function stopProbe(probe) {
  if (!probe.pid || probe.exitCode !== null) return;
  const ended = new Promise(resolve => probe.once('exit', resolve));
  probe.kill('SIGTERM');
  const deadline = setTimeout(() => probe.kill('SIGKILL'), 3000);
  await ended; clearTimeout(deadline);
}
export async function rollbackMigration(config, id) {
  ensureHost(config);
  if (!/^[a-f0-9]{16}$/.test(id)) throw new Error('Invalid migration state ID');
  canonical(config.state);
  const directory = path.join(config.state, id); canonical(directory);
  const state = JSON.parse(fs.readFileSync(path.join(directory, 'state.json'), 'utf8'));
  if (state.directory !== directory || state.backup !== path.join(config.backups, id) ||
      state.legacy !== path.join(config.releases, `legacy-${id}`) || state.id !== id) throw new Error('Invalid rollback state');
  const lock = path.join(config.state, '.active'); fs.mkdirSync(lock);
  privateJson(path.join(lock, 'owner.json'), { pid: process.pid });
  try { await restore(config, state); return { rolledBack: state.phase === 'rolled-back', id }; }
  finally { fs.unlinkSync(path.join(lock, 'owner.json')); fs.rmdirSync(lock); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [operation = '--plan', value, extra] = process.argv.slice(2);
  if (extra || !['--plan', '--apply', '--rollback'].includes(operation) || (operation === '--plan' && value)) throw new Error('Use --plan, --apply <reviewed plan ID>, or --rollback <migration ID>');
  const config = productionMigrationTargets;
  const result = operation === '--plan' ? await migrationPlan(config).then(p => ({ ...p.summary, planId: p.id }))
    : operation === '--apply' ? await applyMigration(config, value) : await rollbackMigration(config, value);
  console.log(JSON.stringify(result, null, 2));
}
