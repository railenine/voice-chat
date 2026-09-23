import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function main() {
  const args = process.argv.slice(2);
  const shouldPush = args.includes('--push') || args.includes('-p');
  const targetVersion = args.find((a) => !a.startsWith('-'));

  if (!targetVersion) {
    console.error('Usage: node scripts/bump-version.js <new-version> [--push]');
    console.error('Example: node scripts/bump-version.js 0.0.46 --push');
    process.exit(1);
  }

  // Validate semantic version format (e.g. 0.0.46 or 1.2.3)
  const cleanVersion = targetVersion.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(cleanVersion)) {
    console.error(`Invalid version format: "${targetVersion}". Expected format like "0.0.46"`);
    process.exit(1);
  }

  console.log(`\n🚀 Bumping project version to: v${cleanVersion}\n`);

  // 1. package.json
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const oldVersion = pkg.version;
  pkg.version = cleanVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`  ✓ package.json: ${oldVersion} -> ${cleanVersion}`);

  // 2. src-tauri/tauri.conf.json
  const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
  if (fs.existsSync(tauriConfPath)) {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    tauriConf.version = cleanVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
    console.log(`  ✓ src-tauri/tauri.conf.json: -> ${cleanVersion}`);
  }

  // 3. src-tauri/Cargo.toml
  const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
  if (fs.existsSync(cargoTomlPath)) {
    let cargo = fs.readFileSync(cargoTomlPath, 'utf8');
    cargo = cargo.replace(/version\s*=\s*"[^"]+"/, `version = "${cleanVersion}"`);
    fs.writeFileSync(cargoTomlPath, cargo, 'utf8');
    console.log(`  ✓ src-tauri/Cargo.toml: -> ${cleanVersion}`);
  }

  // 4. src/config.ts
  const configTsPath = path.join(rootDir, 'src', 'config.ts');
  if (fs.existsSync(configTsPath)) {
    let config = fs.readFileSync(configTsPath, 'utf8');
    config = config.replace(/export const APP_VERSION\s*=\s*'[^']+';/, `export const APP_VERSION = '${cleanVersion}';`);
    fs.writeFileSync(configTsPath, config, 'utf8');
    console.log(`  ✓ src/config.ts: -> ${cleanVersion}`);
  }

  // 5. server/index.js
  const serverPath = path.join(rootDir, 'server', 'index.js');
  if (fs.existsSync(serverPath)) {
    let server = fs.readFileSync(serverPath, 'utf8');
    server = server.replace(/const APP_VERSION\s*=\s*'[^']+';/, `const APP_VERSION = '${cleanVersion}';`);
    fs.writeFileSync(serverPath, server, 'utf8');
    console.log(`  ✓ server/index.js: -> ${cleanVersion}`);
  }

  // 6. public/health
  const healthPath = path.join(rootDir, 'public', 'health');
  if (fs.existsSync(healthPath)) {
    let health = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
    health.version = cleanVersion;
    fs.writeFileSync(healthPath, JSON.stringify(health, null, 2) + '\n', 'utf8');
    console.log(`  ✓ public/health: -> ${cleanVersion}`);
  }

  // 7. CHANGELOG.md
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    let changelog = fs.readFileSync(changelogPath, 'utf8');
    if (!changelog.includes(`## [${cleanVersion}]`)) {
      const today = new Date().toISOString().split('T')[0];
      const template = `\n## [${cleanVersion}] — ${today}\n\n### 🚀 Обновления и улучшения (Updates & Improvements)\n- Обновление компонентов приложения до версии ${cleanVersion}.\n\n---`;
      changelog = changelog.replace(/^---\n/m, `---${template}\n`);
      fs.writeFileSync(changelogPath, changelog, 'utf8');
      console.log(`  ✓ CHANGELOG.md: Added entry for [${cleanVersion}]`);
    } else {
      console.log(`  ✓ CHANGELOG.md: Entry for [${cleanVersion}] already present`);
    }
  }

  console.log(`\n🎉 All files updated to version ${cleanVersion}!`);

  // Optional: Git commit and tag push
  if (shouldPush) {
    console.log('\n📦 Creating git commit, tag, and pushing to origin...');
    try {
      execSync('git add -A', {
        cwd: rootDir,
        stdio: 'inherit',
      });
      execSync(`git commit -m "chore(release): v${cleanVersion}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync(`git tag -a "v${cleanVersion}" -m "Release v${cleanVersion}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync('git push origin main', { cwd: rootDir, stdio: 'inherit' });
      execSync(`git push origin "v${cleanVersion}"`, { cwd: rootDir, stdio: 'inherit' });
      console.log(`\n🚀 Successfully pushed commit and tag v${cleanVersion} to origin!`);
      console.log('GitHub Actions will now build the release and deploy it automatically.');
    } catch (err) {
      console.error('\n❌ Git operation failed:', err.message);
      process.exit(1);
    }
  } else {
    console.log('\nNext steps:');
    console.log('  1. Review changes: git diff');
    console.log(`  2. Commit: git commit -am "chore(release): v${cleanVersion}"`);
    console.log(`  3. Tag:    git tag -a v${cleanVersion} -m "Release v${cleanVersion}"`);
    console.log(`  4. Push:   git push origin main && git push origin v${cleanVersion}`);
    console.log(`  (Or run again with --push to do this automatically)`);
  }
}

main();
