import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Validates updater manifest schema according to RVxis update specification.
 */
export function validateManifestSchema(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifest must be a non-null JSON object');
  }

  if (!manifest.version || typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(manifest.version)) {
    throw new Error(`Manifest has invalid semver version: "${manifest.version}"`);
  }

  if (!manifest.pub_date || Number.isNaN(Date.parse(manifest.pub_date))) {
    throw new Error(`Manifest pub_date is invalid: "${manifest.pub_date}"`);
  }

  if (!manifest.platforms || typeof manifest.platforms !== 'object') {
    throw new Error('Manifest missing "platforms" dictionary');
  }

  const win = manifest.platforms['windows-x86_64'];
  if (!win || !win.url || (!win.url.startsWith('https://') && !win.url.startsWith('http://localhost'))) {
    throw new Error('Manifest missing valid windows-x86_64 platform URL in platforms');
  }

  if (!manifest.portable_url || (!manifest.portable_url.startsWith('https://') && !manifest.portable_url.startsWith('http://localhost'))) {
    throw new Error('Manifest missing valid portable_url');
  }

  return true;
}

function getFileMeta(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { size: 0, sha256: '' };
  }
  const buffer = fs.readFileSync(filePath);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const size = buffer.length;
  return { size, sha256 };
}

function main() {
  if (process.argv.includes('--validate-only') || process.argv.includes('--dry-run')) {
    console.log('=== [Updater] Validating existing latest.json manifests ===');
    const manifests = [
      path.join(rootDir, 'latest.json'),
      path.join(rootDir, 'public', 'api', 'updater', 'latest.json'),
      path.join(rootDir, 'server', 'latest.json'),
    ];
    let checked = 0;
    for (const m of manifests) {
      if (fs.existsSync(m)) {
        const content = JSON.parse(fs.readFileSync(m, 'utf8'));
        validateManifestSchema(content);
        console.log(`[Valid] ${path.relative(rootDir, m)}`);
        checked++;
      }
    }
    console.log(`=== Successfully validated ${checked} manifest(s) ===`);
    return;
  }

  console.log('=== [Updater] Generating latest.json manifest ===');

  // 1. Determine Version
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let version = process.env.TAG_NAME
    ? process.env.TAG_NAME.replace(/^v/, '')
    : pkg.version;
  console.log(`Target version: ${version}`);

  const repo = process.env.GITHUB_REPOSITORY || 'railenine/voice-chat';
  const tag = `v${version}`;

  // 2. Find Installer in bundle/nsis
  const nsisDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
  let installerFile = null;
  let installerPath = null;

  if (fs.existsSync(nsisDir)) {
    const files = fs.readdirSync(nsisDir);
    installerFile =
      files.find((f) => f.endsWith('.exe') && !f.endsWith('.sig') && f.includes(version)) ||
      files.find((f) => f.endsWith('.exe') && !f.endsWith('.sig'));
    if (installerFile) {
      installerPath = path.join(nsisDir, installerFile);
    }
  }

  if (!installerPath || !fs.existsSync(installerPath)) {
    console.warn(`[Updater] Installer not found in ${nsisDir}, checking release root...`);
    const releaseDir = path.join(rootDir, 'src-tauri', 'target', 'release');
    if (fs.existsSync(releaseDir)) {
      const rFiles = fs.readdirSync(releaseDir);
      installerFile = rFiles.find((f) => f.endsWith('.exe') && (f.includes('setup') || f.includes(version)));
      if (installerFile) {
        installerPath = path.join(releaseDir, installerFile);
      }
    }
  }

  // Fallback name if building in environment without installer binary yet
  if (!installerFile) {
    installerFile = `RVxis_${version}_x64-setup.exe`;
    console.warn(`[Updater] Installer file not found locally, using default release name: ${installerFile}`);
  } else {
    console.log(`Found installer: ${installerFile} (${installerPath})`);
  }

  const installerMeta = installerPath ? getFileMeta(installerPath) : { size: 0, sha256: '' };

  // 3. Find Portable executable
  let portablePath = path.join(rootDir, 'src-tauri', 'target', 'release', 'RVxis.exe');
  if (!fs.existsSync(portablePath)) {
    portablePath = path.join(rootDir, 'src-tauri', 'target', 'release', 'voice-chat.exe');
  }
  if (!fs.existsSync(portablePath)) {
    portablePath = path.join(rootDir, 'RVxis-Portable.exe');
  }

  let portableMeta = { size: 0, sha256: '' };
  if (fs.existsSync(portablePath)) {
    portableMeta = getFileMeta(portablePath);
    console.log(`Found portable binary: ${path.basename(portablePath)} (${(portableMeta.size / (1024 * 1024)).toFixed(1)} MB, sha256: ${portableMeta.sha256.slice(0, 12)}...)`);
  } else {
    console.warn('[Updater] Portable binary not found in release folder; metadata will be populated without local size/hash.');
  }

  // 4. Obtain Tauri Signature for installer
  let signature = '';
  const sigFile = installerPath ? `${installerPath}.sig` : null;

  const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
  const privateKeyPassword = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
  const localKeyPath = path.join(rootDir, 'src-tauri', 'voicechat.key');

  let keyToUse = null;
  let tempKeyPath = null;

  if (privateKey) {
    tempKeyPath = path.join(rootDir, 'src-tauri', 'temp_ci_voicechat.key');
    fs.writeFileSync(tempKeyPath, privateKey.trim(), 'utf8');
    keyToUse = tempKeyPath;
    console.log('[Updater] Using private key from environment variable.');
  } else if (fs.existsSync(localKeyPath)) {
    keyToUse = localKeyPath;
    console.log('[Updater] Using local private key at src-tauri/voicechat.key.');
  }

  if (keyToUse && !privateKeyPassword) {
    console.warn('[Updater] TAURI_SIGNING_PRIVATE_KEY_PASSWORD is not set; skipping live signing to avoid stdin prompt, using existing signature/fallback.');
    keyToUse = null;
  }

  try {
    if (keyToUse && installerPath && fs.existsSync(installerPath)) {
      console.log(`[Updater] Signing ${installerFile} with Tauri signer...`);
      const signCmd = `npx @tauri-apps/cli signer sign -f "${keyToUse}" --password "${privateKeyPassword}" --app-version "${version}" "${installerPath}"`;
      const output = execSync(signCmd, {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (sigFile && fs.existsSync(sigFile)) {
        const rawSig = fs.readFileSync(sigFile, 'utf8').trim();
        signature = Buffer.from(rawSig).toString('base64');
        console.log('[Updater] Extracted signature from generated .sig file.');
      } else {
        const match = output.match(/Public signature:\s*([A-Za-z0-9+/=]+)/);
        if (match && match[1]) {
          signature = match[1].trim();
          console.log('[Updater] Extracted signature from signer command output.');
        }
      }
    } else if (sigFile && fs.existsSync(sigFile)) {
      const rawSig = fs.readFileSync(sigFile, 'utf8').trim();
      signature = Buffer.from(rawSig).toString('base64');
      console.log('[Updater] Found existing .sig file.');
    }
  } catch (err) {
    console.warn('[Updater] Signing warning/fallback:', err.message);
  } finally {
    if (tempKeyPath && fs.existsSync(tempKeyPath)) {
      try {
        fs.unlinkSync(tempKeyPath);
      } catch (e) {}
    }
  }

  // Fallback to existing signature if available
  if (!signature) {
    const existingPath = path.join(rootDir, 'latest.json');
    if (fs.existsSync(existingPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
        if (existing.platforms?.['windows-x86_64']?.signature) {
          signature = existing.platforms['windows-x86_64'].signature;
          console.log('[Updater] Retained existing signature as fallback.');
        }
      } catch {}
    }
  }

  // 5. Extract Release Notes from HISTORY.md (with CHANGELOG.md fallback)
  let notes = `RVxis v${version} - WebRTC Voice Chat`;
  const historyPath = fs.existsSync(path.join(rootDir, 'HISTORY.md'))
    ? path.join(rootDir, 'HISTORY.md')
    : path.join(rootDir, 'CHANGELOG.md');
  const releaseNotesPath = path.join(rootDir, 'RELEASE_NOTES.md');
  let generatedNotes = false;

  if (fs.existsSync(historyPath)) {
    const changelog = fs.readFileSync(historyPath, 'utf8');
    const versionHeaderRegex = new RegExp(`(?:^|\\n)#{2,4}\\s*(?:##\\s*)?\\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n#{2,4}\\s*(?:##\\s*)?\\[|$)`);
    const match = changelog.match(versionHeaderRegex);
    if (match && match[1]) {
      const fullNotes = match[1].replace(/\n*---\s*$/, '').trim();
      fs.writeFileSync(releaseNotesPath, fullNotes + '\n', 'utf8');
      console.log(`[Updater] Generated RELEASE_NOTES.md from ${path.basename(historyPath)}.`);
      generatedNotes = true;

      const lines = match[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('-') || l.startsWith('*'))
        .map((l) => l.replace(/^[-*]\s*/, '').replace(/\*\*/g, ''));
      if (lines.length > 0) {
        notes = `RVxis v${version} — ${lines.slice(0, 3).join('; ')}`;
      }
    }
  }

  if (!generatedNotes) {
    fs.writeFileSync(releaseNotesPath, `RVxis v${version} - P2P WebRTC Voice Chat\n`, 'utf8');
    console.log('[Updater] Generated default RELEASE_NOTES.md.');
  }

  // 6. Construct Unified Manifest
  const manifest = {
    version: version,
    notes: notes,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: signature,
        url: `https://github.com/${repo}/releases/download/${tag}/${installerFile}`,
        size: installerMeta.size || undefined,
        sha256: installerMeta.sha256 || undefined,
      },
    },
    portable: {
      'windows-x86_64': {
        url: `https://github.com/${repo}/releases/download/${tag}/RVxis.exe`,
        size: portableMeta.size || undefined,
        sha256: portableMeta.sha256 || undefined,
        signature: '',
      },
    },
    portable_url: `https://github.com/${repo}/releases/download/${tag}/RVxis.exe`,
  };

  // 7. Validate Manifest Schema
  validateManifestSchema(manifest);
  console.log('[Updater] Manifest schema validated successfully.');

  const jsonStr = JSON.stringify(manifest, null, 2) + '\n';
  console.log('[Updater] Generated manifest:');
  console.log(jsonStr);

  // 8. Write to destination files
  const destinations = [
    path.join(rootDir, 'latest.json'),
    path.join(rootDir, 'public', 'api', 'updater', 'latest.json'),
    path.join(rootDir, 'server', 'latest.json'),
    path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'updater', 'latest.json'),
    path.join(rootDir, 'src-tauri', 'target', 'release', 'latest.json'),
  ];

  for (const dest of destinations) {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dest, jsonStr, 'utf8');
    console.log(`[Updater] Wrote ${dest}`);
  }

  console.log('=== [Updater] latest.json generated successfully ===');
}

// Only execute directly when run from CLI
if (process.argv[1] && process.argv[1].endsWith('generate-latest-json.js')) {
  main();
}
