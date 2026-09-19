#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(fileURLToPath(import.meta.url), '..');

// Check if dist folder exists
const distPath = join(__dirname, 'dist');
if (!existsSync(distPath)) {
  console.log('📦 Building frontend...');
  const build = spawn('npm', ['run', 'build'], { 
    stdio: 'inherit',
    shell: true 
  });
  
  build.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Build failed');
      process.exit(1);
    }
    startServer();
  });
} else {
  startServer();
}

function startServer() {
  console.log('🚀 Starting server...');
  const server = spawn('node', ['server/index.js'], { 
    stdio: 'inherit',
    shell: true 
  });
  
  server.on('close', (code) => {
    process.exit(code || 0);
  });
}
