#!/usr/bin/env node

/**
 * Диагностика PeerJS сервера
 * 
 * Этот скрипт проверяет:
 * 1. Работает ли сервер
 * 2. Доступен ли PeerJS endpoint
 * 3. Можно ли получить UUID
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

console.log('🔍 Диагностика PeerJS сервера');
console.log('==============================\n');
console.log(`URL: ${BASE_URL}\n`);

// Тест 1: Health check
console.log('1️⃣  Проверка health check...');
makeRequest('/health')
  .then(data => {
    console.log('   ✅ Health check работает');
    console.log(`   Ответ: ${JSON.stringify(data)}\n`);
    return testPeerJS();
  })
  .catch(err => {
    console.error('   ❌ Health check не работает');
    console.error(`   Ошибка: ${err.message}\n`);
    process.exit(1);
  });

// Тест 2: PeerJS endpoints
async function testPeerJS() {
  console.log('2️⃣  Проверка PeerJS endpoints...\n');
  
  // Тест /peerjs/id
  console.log('   📡 Проверка /peerjs/id...');
  try {
    const id = await makeRequest('/peerjs/id');
    console.log('   ✅ /peerjs/id работает');
    console.log(`   UUID: ${id}\n`);
  } catch (err) {
    console.error('   ❌ /peerjs/id не работает');
    console.error(`   Ошибка: ${err.message}`);
    console.error(`   Статус: ${err.statusCode || 'N/A'}\n`);
  }
  
  // Тест /peerjs/peers
  console.log('   📡 Проверка /peerjs/peers...');
  try {
    const peers = await makeRequest('/peerjs/peers');
    console.log('   ✅ /peerjs/peers работает');
    console.log(`   Ответ: ${JSON.stringify(peers)}\n`);
  } catch (err) {
    console.error('   ❌ /peerjs/peers не работает');
    console.error(`   Ошибка: ${err.message}`);
    console.error(`   Статус: ${err.statusCode || 'N/A'}\n`);
  }
  
  // Тест /peerjs (без пути)
  console.log('   📡 Проверка /peerjs (без пути)...');
  try {
    const result = await makeRequest('/peerjs');
    console.log('   ✅ /peerjs работает');
    console.log(`   Ответ: ${JSON.stringify(result)}\n`);
  } catch (err) {
    console.error('   ❌ /peerjs не работает');
    console.error(`   Ошибка: ${err.message}`);
    console.error(`   Статус: ${err.statusCode || 'N/A'}\n`);
  }
  
  console.log('==============================');
  console.log('✅ Диагностика завершена\n');
  
  console.log('💡 Рекомендации:');
  console.log('   - Если /peerjs/id не работает, проверьте конфигурацию PeerJS');
  console.log('   - Убедитесь что сервер перезапущен после изменений');
  console.log('   - Проверьте логи сервера: pm2 logs voicechat\n');
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          const error = new Error(`HTTP ${res.statusCode}: ${data}`);
          error.statusCode = res.statusCode;
          reject(error);
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}
