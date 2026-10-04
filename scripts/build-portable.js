import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n🚀 [Manual Testing] Building frontend and fresh desktop binary...');

// Check config.ts setting
const configPath = path.join(rootDir, 'src', 'config.ts');
if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, 'utf8');
  const isLocal = /USE_LOCAL_SERVER_FOR_TAURI_TESTS\s*=\s*true/.test(configContent);
  console.log(`📡 [Config Check] Tauri server mode: ${isLocal ? 'LOCAL (http://localhost:3000)' : 'PRODUCTION (https://rvxis.site)'}`);
}

// 1. Build Vite frontend
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

// 2. Build Tauri standalone release binary
execSync('npx tauri build --no-bundle', { cwd: rootDir, stdio: 'inherit' });

// 3. Copy to project root as RVxis.exe, RVxis-Portable.exe and VoiceChat-Portable.exe
const srcExe = path.join(rootDir, 'src-tauri', 'target', 'release', 'voice-chat.exe');
const destReleaseExe = path.join(rootDir, 'src-tauri', 'target', 'release', 'RVxis.exe');
const destExe1 = path.join(rootDir, 'RVxis.exe');
const destExe2 = path.join(rootDir, 'RVxis-Portable.exe');
const destExe3 = path.join(rootDir, 'VoiceChat-Portable.exe');

function safeCopyFile(src, dest) {
  try {
    fs.copyFileSync(src, dest);
  } catch (err) {
    if (err.code === 'EBUSY') {
      const bakPath = `${dest}.${Date.now()}.bak`;
      try {
        fs.renameSync(dest, bakPath);
        fs.copyFileSync(src, dest);
      } catch (innerErr) {
        console.warn(`[build-portable] Warning: Could not overwrite ${path.basename(dest)}: ${innerErr.message}`);
      }
    } else {
      throw err;
    }
  }
}

if (fs.existsSync(srcExe)) {
  safeCopyFile(srcExe, destReleaseExe);
  safeCopyFile(srcExe, destExe1);
  safeCopyFile(srcExe, destExe2);
  safeCopyFile(srcExe, destExe3);
  const sizeMb = (fs.statSync(destExe1).size / (1024 * 1024)).toFixed(1);
  console.log(`\n✅ [Manual Testing] RVxis.exe & RVxis-Portable.exe (${sizeMb} MB) successfully updated in project root!\n`);
} else {
  console.error('\n❌ [Manual Testing] Error: voice-chat.exe was not found in src-tauri/target/release/\n');
  process.exit(1);
}
