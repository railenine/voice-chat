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

// 3. Copy to project root as RVxis-Portable.exe
const srcExe = path.join(rootDir, 'src-tauri', 'target', 'release', 'voice-chat.exe');
const destExe1 = path.join(rootDir, 'RVxis-Portable.exe');
const destExe2 = path.join(rootDir, 'VoiceChat-Portable.exe');

if (fs.existsSync(srcExe)) {
  fs.copyFileSync(srcExe, destExe1);
  fs.copyFileSync(srcExe, destExe2);
  const sizeMb = (fs.statSync(destExe1).size / (1024 * 1024)).toFixed(1);
  console.log(`\n✅ [Manual Testing] RVxis-Portable.exe (${sizeMb} MB) successfully updated in project root!\n`);
} else {
  console.error('\n❌ [Manual Testing] Error: voice-chat.exe was not found in src-tauri/target/release/\n');
  process.exit(1);
}
