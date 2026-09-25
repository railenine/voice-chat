import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function main() {
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
    // Find installer exe matching this version first, or fallback to any non-sig exe
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

  if (!installerPath || !fs.existsSync(installerPath)) {
    console.error('[Updater] ERROR: Could not find Windows installer executable to sign!');
    process.exit(1);
  }

  console.log(`Found installer: ${installerFile} (${installerPath})`);

  // 3. Obtain Signature
  let signature = '';
  const sigFile = `${installerPath}.sig`;

  // Check if .sig already exists or we need to sign
  const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
  const privateKeyPassword = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || 'VoiceChat2026!';
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

  try {
    if (keyToUse) {
      console.log(`[Updater] Signing ${installerFile} with Tauri signer...`);
      const signCmd = `npx @tauri-apps/cli signer sign -f "${keyToUse}" --password "${privateKeyPassword}" --app-version "${version}" "${installerPath}"`;
      const output = execSync(signCmd, {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Extract from output or from .sig file
      if (fs.existsSync(sigFile)) {
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
    } else if (fs.existsSync(sigFile)) {
      const rawSig = fs.readFileSync(sigFile, 'utf8').trim();
      signature = Buffer.from(rawSig).toString('base64');
      console.log('[Updater] Found existing .sig file.');
    }
  } catch (err) {
    console.error('[Updater] Error during signing:', err.message);
  } finally {
    if (tempKeyPath && fs.existsSync(tempKeyPath)) {
      try {
        fs.unlinkSync(tempKeyPath);
      } catch (e) {}
    }
  }

  if (!signature) {
    console.warn('[Updater] WARNING: No signature was generated. Checking existing latest.json for fallback...');
    const existingPath = path.join(rootDir, 'latest.json');
    if (fs.existsSync(existingPath)) {
      const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
      if (existing.platforms?.['windows-x86_64']?.signature) {
        signature = existing.platforms['windows-x86_64'].signature;
        console.log('[Updater] Retained previous signature as fallback.');
      }
    }
  }

  // 4. Extract Release Notes from CHANGELOG.md if available
  let notes = `RVxis v${version}`;
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  const releaseNotesPath = path.join(rootDir, 'RELEASE_NOTES.md');
  let generatedNotes = false;

  if (fs.existsSync(changelogPath)) {
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    const versionHeaderRegex = new RegExp(`##\\s*\\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s*\\[|$)`);
    const match = changelog.match(versionHeaderRegex);
    if (match && match[1]) {
      const fullNotes = match[1].replace(/\n*---\s*$/, '').trim();
      fs.writeFileSync(releaseNotesPath, fullNotes + '\n', 'utf8');
      console.log(`[Updater] Generated RELEASE_NOTES.md for GitHub Release.`);
      generatedNotes = true;

      // Clean up markdown bullet points for notes
      const lines = match[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('-') || l.startsWith('*'))
        .map((l) => l.replace(/^[-*]\s*/, '').replace(/\*\*/g, ''));
      if (lines.length > 0) {
        notes = `RVxis v${version} - ${lines.slice(0, 3).join('; ')}`;
      }
    }
  }

  if (!generatedNotes) {
    fs.writeFileSync(releaseNotesPath, `RVxis v${version}\n`, 'utf8');
    console.log(`[Updater] Generated fallback RELEASE_NOTES.md.`);
  }

  // 5. Construct latest.json
  const manifest = {
    version: version,
    notes: notes,
    pub_date: new Date().toISOString(),
    portable_url: `https://github.com/${repo}/releases/download/${tag}/voice-chat.exe`,
    platforms: {
      'windows-x86_64': {
        signature: signature,
        url: `https://github.com/${repo}/releases/download/${tag}/${installerFile}`,
      },
    },
  };

  const jsonStr = JSON.stringify(manifest, null, 2) + '\n';
  console.log('[Updater] Manifest constructed:');
  console.log(jsonStr);

  // 6. Write to destination files
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

main();
