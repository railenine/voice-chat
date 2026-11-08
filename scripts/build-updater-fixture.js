import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createFixtureSigner, assetMetadata, FIXTURE_ORIGIN } from './updater-fixture.js';
import { verifyArtifact } from './release-security.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--portable-only') { options.portableOnly = true; continue; }
  if (!['--work-dir', '--output-dir'].includes(args[i]) || !args[i + 1]) throw new Error('Use --work-dir <path> --output-dir <path> [--portable-only]');
  options[args[i]] = path.resolve(args[++i]);
}
if (process.platform !== 'win32' || !options['--work-dir'] || !options['--output-dir']) throw new Error('Windows and explicit directories are required');
const run = (command, argv, cwd = root, env = process.env, quiet = false) => {
  try { return execFileSync(command, argv, { cwd, env, stdio: quiet ? 'ignore' : 'inherit' }); }
  catch { throw new Error(`Fixture operation failed: ${path.basename(command)}. No production artifact was published.`); }
};
const git = argv => execFileSync('git', argv, { cwd: root, encoding: 'utf8' }).trim();
if (git(['status', '--porcelain'])) throw new Error('Commit reviewed source changes first');
const revision = git(['rev-parse', 'HEAD']);
const id = crypto.randomBytes(4).toString('hex');
const identifier = `com.railenine.voicechat.updatertest.run${id}`;
const productName = `RVxis Update Test ${id}`;
const binaryName = `rvxis-updater-test-${id}`;
fs.mkdirSync(options['--work-dir'], { recursive: true });
fs.mkdirSync(options['--output-dir'], { recursive: true });
const source = fs.mkdtempSync(path.join(options['--work-dir'], 'updater-source-'));
const output = path.join(options['--output-dir'], `updater-fixture-${revision.slice(0, 12)}-${id}`);
fs.mkdirSync(output);
const tls = path.join(source, 'private-tls');
fs.mkdirSync(tls);
run('git', ['archive', '--format=tar', `--output=${source}.tar`, revision]);
run('tar', ['-xf', `${source}.tar`, '-C', source]);
try { fs.symlinkSync(path.join(root, 'node_modules'), path.join(source, 'node_modules'), 'junction'); }
catch (error) {
  if (!['EPERM', 'EACCES'].includes(error.code) || fs.existsSync(path.join(source, 'node_modules'))) throw error;
  console.log('Copying cached dependencies into the disposable updater snapshot.');
  fs.cpSync(path.join(root, 'node_modules'), path.join(source, 'node_modules'), { recursive: true, dereference: true, force: false, errorOnExist: true });
}
const signer = createFixtureSigner();
const foreign = createFixtureSigner();
const openssl = process.env.RVXIS_OPENSSL || 'C:/Program Files/Git/mingw64/bin/openssl.exe';
run(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-days', '7', '-nodes',
  '-subj', '/CN=RVxis disposable updater CA', '-addext', 'basicConstraints=critical,CA:TRUE',
  '-keyout', 'ca-key.pem', '-out', 'ca.pem'], tls, process.env, true);
run(openssl, ['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=localhost',
  '-keyout', 'server-key.pem', '-out', 'server.csr'], tls, process.env, true);
fs.writeFileSync(path.join(tls, 'server.ext'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n');
run(openssl, ['x509', '-req', '-in', 'server.csr', '-CA', 'ca.pem', '-CAkey', 'ca-key.pem',
  '-CAcreateserial', '-days', '7', '-sha256', '-extfile', 'server.ext', '-out', 'server.pem'], tls, process.env, true);
fs.unlinkSync(path.join(tls, 'ca-key.pem'));
const native = path.join(source, 'src-tauri');
fs.copyFileSync(path.join(tls, 'ca.pem'), path.join(native, 'fixture-ca.pem'));
fs.copyFileSync(path.join(tls, 'ca.pem'), path.join(output, 'fixture-ca.pem'));
fs.writeFileSync(path.join(native, 'voicechat.key.pub'), signer.encodedKey);
fs.writeFileSync(path.join(native, 'fixture-signature.txt'), signer.sign(Buffer.from('rvxis-local-updater-fixture')));
fs.copyFileSync(path.join(source, 'scripts/updater-fixture-native.rs'), path.join(native, 'src/updater_fixture.rs'));

const patch = (file, before, after) => {
  const text = fs.readFileSync(file, 'utf8');
  if (text.split(before).length !== 2) throw new Error(`Review changed fixture patch boundary: ${path.basename(file)}`);
  fs.writeFileSync(file, text.replace(before, after));
};
const lib = path.join(native, 'src/lib.rs');
patch(lib, 'mod portable_security;', 'mod portable_security;\nmod updater_fixture;');
patch(lib, 'is_desktop,', 'updater_fixture::fixture_check,\n            is_desktop,');
patch(lib, '    portable_security::ensure_updates_enabled()?;', `    if app.config().identifier != "${identifier}" || !download_url.starts_with("${FIXTURE_ORIGIN}/files/") {\n        return Err("Fixture refuses nonlocal portable updates".into());\n    }\n    portable_security::ensure_updates_enabled()?;`);
patch(lib, '        .https_only(true)', '        .https_only(true)\n        .no_proxy()\n        .add_root_certificate(reqwest::Certificate::from_pem(include_bytes!("../fixture-ca.pem")).map_err(|e| e.to_string())?)');
const hook = path.join(source, 'src/hooks/useAppUpdater.ts');
patch(hook, 'APP_VERSION, IS_STAGING_BUILD', 'APP_VERSION');
patch(hook, "const DISMISSED_VERSION_KEY", 'const IS_STAGING_BUILD = false; // Only this disposable updater snapshot enables updates.\nconst DISMISSED_VERSION_KEY');
patch(hook, "await import('@tauri-apps/plugin-updater')", "await import('../updater-fixture')");
// No fallback in this test copy may contact production or a GitHub release.
fs.writeFileSync(hook, fs.readFileSync(hook, 'utf8').replaceAll('https://github.com/railenine/voice-chat/releases/', `${FIXTURE_ORIGIN}/disabled-release-fallback/`));
fs.writeFileSync(path.join(source, 'src/updater-fixture.ts'), `import { invoke } from '@tauri-apps/api/core';\nimport { Update } from '@tauri-apps/plugin-updater';\nexport async function check() { const data = await invoke<ConstructorParameters<typeof Update>[0] | null>('fixture_check'); return data ? new Update(data) : null; }\n`);
patch(path.join(source, 'src/components/TitleBar.tsx'), '>STAGING</span>', '>UPDATER TEST</span>');
const configPath = path.join(source, 'src/config.ts');
patch(configPath, 'const USE_LOCAL_SERVER_FOR_TAURI_TESTS = false;', 'const USE_LOCAL_SERVER_FOR_TAURI_TESTS = true;');
patch(configPath, "export const PRODUCTION_SERVER = 'https://rvxis.site';", "export const PRODUCTION_SERVER = 'http://localhost:3000';");
patch(configPath, "export const PRODUCTION_WS = 'wss://rvxis.site/peerjs/ws';", "export const PRODUCTION_WS = 'ws://localhost:3000/peerjs/ws';");
const configTemplate = fs.readFileSync(configPath, 'utf8');
const cargoTemplate = fs.readFileSync(path.join(native, 'Cargo.toml'), 'utf8');
const lockTemplate = fs.readFileSync(path.join(native, 'Cargo.lock'), 'utf8').replaceAll('\r\n', '\n');
const base = JSON.parse(fs.readFileSync(path.join(native, 'tauri.conf.json'), 'utf8'));
const originalVersion = base.version;
if (lockTemplate.split(`name = "voice-chat"\nversion = "${originalVersion}"`).length !== 2) throw new Error('Review the fixture Cargo.lock package boundary');
const env = { ...process.env, NODE_ENV: 'production', VITE_RVXIS_STAGING: '1', CARGO_TARGET_DIR: path.join(root, 'src-tauri/target') };
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
env[pathKey] = `${path.dirname(process.execPath)}${path.delimiter}${env[pathKey] || ''}`;
delete env.TAURI_SIGNING_PRIVATE_KEY;
delete env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
const metadata = { sourceCommit: revision, identifier, productName, binaryName, publicKey: signer.encodedKey,
  origin: FIXTURE_ORIGIN, tlsDirectory: tls, complete: false, installerBuilt: !options.portableOnly,
  foreignSignatures: {}, productionPublished: false };
for (const [label, version] of [['initial', '0.2.9001'], ['target', '0.2.9002']]) {
  fs.writeFileSync(configPath, configTemplate.replace(`APP_VERSION = '${originalVersion}'`, `APP_VERSION = '${version}'`));
  fs.writeFileSync(path.join(native, 'Cargo.toml'), cargoTemplate.replace(`version = "${originalVersion}"`, `version = "${version}"`));
  fs.writeFileSync(path.join(native, 'Cargo.lock'), lockTemplate.replace(`name = "voice-chat"\nversion = "${originalVersion}"`, `name = "voice-chat"\nversion = "${version}"`));
  const override = { version, productName, identifier, mainBinaryName: binaryName,
    build: { beforeBuildCommand: '', frontendDist: '../dist' },
    plugins: { updater: { pubkey: signer.encodedKey, endpoints: [`${FIXTURE_ORIGIN}/latest.json`] } },
    app: { windows: base.app.windows.map(window => ({ ...window, title: `${productName} ${version} — TEST ONLY` })) },
    bundle: { createUpdaterArtifacts: false, useLocalToolsDir: true, windows: { nsis: { installMode: 'currentUser' } } } };
  fs.writeFileSync(path.join(native, 'tauri.conf.json'), JSON.stringify({ ...base, ...override,
    build: { ...base.build, ...override.build }, app: { ...base.app, ...override.app },
    plugins: { ...base.plugins, ...override.plugins }, bundle: { ...base.bundle, ...override.bundle } }, null, 2));
  run(process.execPath, [path.join(source, 'node_modules/vite/bin/vite.js'), 'build'], source, env);
  const started = Date.now();
  run(process.execPath, [path.join(source, 'node_modules/@tauri-apps/cli/tauri.js'), 'build',
    ...(options.portableOnly ? ['--no-bundle'] : ['--bundles', 'nsis']), '--config', JSON.stringify(override), '--', '--locked', '--offline'], native, env);
  run('cargo', ['test', '--manifest-path', path.join(native, 'Cargo.toml'), '--lib', '--release', '--locked', '--offline'], source, env);
  const bytes = fs.readFileSync(path.join(env.CARGO_TARGET_DIR, `release/${binaryName}.exe`));
  const asset = fs.readFileSync(path.join(source, 'dist/index.html'), 'utf8').match(/assets\/(index-[^"/]+\.js)/)?.[1];
  if (!asset || !bytes.includes(Buffer.from(asset)) || !bytes.includes(Buffer.from(identifier)) ||
      !bytes.includes(Buffer.from('Fixture refuses a nonlocal update URL')) ||
      !bytes.includes(Buffer.from('Fixture refuses nonlocal portable updates')) ||
      !bytes.includes(Buffer.from(signer.encodedKey))) throw new Error('Fixture embedding check failed');
  const portable = assetMetadata(`RVxis-Updater-Test-${label}.exe`, bytes, signer);
  fs.writeFileSync(path.join(output, portable.file), bytes);
  verifyArtifact(path.join(output, portable.file), portable.signature, signer.encodedKey);
  metadata.foreignSignatures[portable.file] = foreign.sign(bytes);
  metadata[label] = { version, portable };
  if (!options.portableOnly) {
    const bundles = path.join(env.CARGO_TARGET_DIR, 'release/bundle/nsis');
    const files = fs.readdirSync(bundles).filter(file => file.startsWith(productName + '_') && file.endsWith('-setup.exe') && fs.statSync(path.join(bundles, file)).mtimeMs >= started);
    if (files.length !== 1) throw new Error('Expected one freshly built test setup');
    const setup = fs.readFileSync(path.join(bundles, files[0]));
    const installer = assetMetadata(`RVxis-Updater-Test-${label}-Setup.exe`, setup, signer);
    fs.writeFileSync(path.join(output, installer.file), setup);
    verifyArtifact(path.join(output, installer.file), installer.signature, signer.encodedKey);
    metadata.foreignSignatures[installer.file] = foreign.sign(setup);
    metadata[label].installer = installer;
  }
}
metadata.complete = true;
fs.writeFileSync(path.join(output, 'fixture.json'), JSON.stringify(metadata, null, 2));
console.log(JSON.stringify({ fixtureDirectory: output, versions: [metadata.initial.version, metadata.target.version],
  installerBuilt: metadata.installerBuilt, identifier, complete: true, productionPublished: false }, null, 2));
