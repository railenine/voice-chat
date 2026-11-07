import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--installer') { options.installer = true; continue; }
  if (!['--work-dir', '--output-dir'].includes(args[i]) || !args[i + 1]) throw new Error('Use --work-dir <path> --output-dir <path>');
  options[args[i]] = path.resolve(args[i + 1]);
  i += 1;
}
if (process.platform !== 'win32' || !options['--work-dir'] || !options['--output-dir']) throw new Error('Windows and explicit work/output directories are required.');
const run = (command, arguments_, cwd = root, env = process.env) => execFileSync(command, arguments_, { cwd, env, stdio: 'inherit' });
if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) throw new Error('Commit reviewed changes before producing a reproducible staging snapshot.');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const short = revision.slice(0, 12);
fs.mkdirSync(options['--work-dir'], { recursive: true });
fs.mkdirSync(options['--output-dir'], { recursive: true });
const source = fs.mkdtempSync(path.join(options['--work-dir'], 'desktop-source-'));
const archive = `${source}.tar`;
run('git', ['archive', '--format=tar', `--output=${archive}`, revision]);
run('tar', ['-xf', archive, '-C', source]);
const dependencies = path.join(source, 'node_modules');
try {
  fs.symlinkSync(path.join(root, 'node_modules'), dependencies, 'junction');
} catch (error) {
  if (!['EPERM', 'EACCES'].includes(error.code) || fs.lstatSync(dependencies, { throwIfNoEntry: false })) throw error;
  console.log('Junction unavailable; copying installed dependencies into the isolated snapshot.');
  fs.cpSync(path.join(root, 'node_modules'), dependencies, { recursive: true, dereference: true, force: false, errorOnExist: true });
}

// Apply the repository's manual-testing flag only to this isolated snapshot.
const configPath = path.join(source, 'src', 'config.ts');
const config = fs.readFileSync(configPath, 'utf8');
const localFlag = 'const USE_LOCAL_SERVER_FOR_TAURI_TESTS = false;';
if (!config.includes(localFlag)) throw new Error('Review the local-server flag before building.');
fs.writeFileSync(configPath, config.replace(localFlag, 'const USE_LOCAL_SERVER_FOR_TAURI_TESTS = true;'));

const env = { ...process.env, NODE_ENV: 'production', VITE_RVXIS_STAGING: '1', CARGO_TARGET_DIR: path.join(root, 'src-tauri', 'target') };
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
env[pathKey] = `${path.dirname(process.execPath)}${path.delimiter}${env[pathKey] || ''}`;
delete env.TAURI_SIGNING_PRIVATE_KEY;
delete env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
run(process.execPath, [path.join(source, 'node_modules/vite/bin/vite.js'), 'build'], source, env);
const base = JSON.parse(fs.readFileSync(path.join(source, 'src-tauri/tauri.conf.json'), 'utf8'));
const override = {
  productName: 'RVxis Staging', identifier: 'com.railenine.voicechat.staging',
  mainBinaryName: 'rvxis-staging',
  bundle: { createUpdaterArtifacts: false, useLocalToolsDir: true, windows: { nsis: { installMode: 'currentUser' } } },
  // An absolute Windows path can deserialize as a C: URL, disabling embedding.
  build: { beforeBuildCommand: '', frontendDist: '../dist' },
  app: { windows: base.app.windows.map(window => ({ ...window, title: 'RVxis Staging — test only' })) },
};
const buildStarted = Date.now();
run(process.execPath, [path.join(source, 'node_modules/@tauri-apps/cli/tauri.js'), 'build', ...(options.installer ? ['--bundles', 'nsis'] : ['--no-bundle']),
  '--features', 'staging', '--config', JSON.stringify(override), '--', '--locked', '--offline'], path.join(source, 'src-tauri'), env);
run('cargo', ['test', '--manifest-path', path.join(source, 'src-tauri/Cargo.toml'), '--lib', '--features', 'staging', '--release', '--locked', '--offline'], source, env);
const binary = fs.readFileSync(path.join(env.CARGO_TARGET_DIR, 'release/rvxis-staging.exe'));
const html = fs.readFileSync(path.join(source, 'dist/index.html'), 'utf8');
const asset = html.match(/assets\/(index-[^"/]+\.js)/)?.[1];
if (!asset || !binary.includes(Buffer.from(asset)) || !binary.includes(Buffer.from('com.railenine.voicechat.staging')) ||
    !binary.includes(Buffer.from('Updates are disabled in the staging build'))) throw new Error('Staging binary verification failed.');
const file = `RVxis-Staging-${short}.exe`;
fs.writeFileSync(path.join(options['--output-dir'], file), binary);
const metadata = { sourceCommit: revision, file, bytes: binary.length,
  sha256: crypto.createHash('sha256').update(binary).digest('hex'), identifier: override.identifier,
  backend: 'http://localhost:3000', websocket: 'ws://localhost:3000/peerjs/ws',
  binaryName: override.mainBinaryName, updatesEnabled: false, installerBuilt: false, productionPublished: false };
if (options.installer) {
  const directory = path.join(env.CARGO_TARGET_DIR, 'release/bundle/nsis');
  const candidates = fs.readdirSync(directory).filter(name => /staging.*setup\.exe$/i.test(name) && fs.statSync(path.join(directory, name)).mtimeMs >= buildStarted);
  if (candidates.length !== 1) throw new Error('Expected exactly one freshly built staging installer.');
  const installer = fs.readFileSync(path.join(directory, candidates[0]));
  metadata.installer = { file: `RVxis-Staging-Setup-${short}.exe`, bytes: installer.length,
    sha256: crypto.createHash('sha256').update(installer).digest('hex'), installMode: 'currentUser' };
  fs.writeFileSync(path.join(options['--output-dir'], metadata.installer.file), installer);
  metadata.installerBuilt = true;
}
fs.writeFileSync(path.join(options['--output-dir'], options.installer ? 'staging-installer-metadata.json' : 'staging-desktop-metadata.json'), JSON.stringify(metadata, null, 2));
console.log(JSON.stringify(metadata, null, 2));
