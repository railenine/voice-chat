#!/usr/bin/env node

/**
 * VoiceChat Server Test Script
 * 
 * This script tests the server endpoints and functionality.
 */

import http from 'http';
import { WebSocket } from 'ws';

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3000';

async function testEndpoint(path, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === expectedStatus) {
          console.log(`✅ ${path} - ${res.statusCode} OK`);
          resolve({ status: res.statusCode, data });
        } else {
          console.error(`❌ ${path} - Expected ${expectedStatus}, got ${res.statusCode}`);
          reject(new Error(`Expected ${expectedStatus}, got ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      console.error(`❌ ${path} - Connection error: ${err.message}`);
      reject(err);
    });
  });
}

async function runTests() {
  console.log('🧪 VoiceChat Server Tests');
  console.log('=========================\n');
  
  let passed = 0;
  let failed = 0;
  
  try {
    // Test health endpoint
    console.log('Testing health endpoint...');
    const healthResult = await testEndpoint('/health');
    const healthData = JSON.parse(healthResult.data);
    
    if (healthData.status === 'ok') {
      console.log('   ✓ Health status is OK');
      passed++;
    } else {
      console.error('   ✗ Health status is not OK');
      failed++;
    }
    
    if (healthData.service === 'rvxis-server' || healthData.service === 'voicechat-server') {
      console.log('   ✓ Service name is correct (' + healthData.service + ')');
      passed++;
    } else {
      console.error('   ✗ Service name is incorrect');
      failed++;
    }
    
    // Test API info endpoint
    console.log('\nTesting API info endpoint...');
    const infoResult = await testEndpoint('/api/info');
    const infoData = JSON.parse(infoResult.data);
    
    if (infoData.name === 'RVxis Server' || infoData.name === 'VoiceChat Server') {
      console.log('   ✓ API name is correct (' + infoData.name + ')');
      passed++;
    } else {
      console.error('   ✗ API name is incorrect');
      failed++;
    }
    
    if (infoData.peerServer === '/peerjs') {
      console.log('   ✓ PeerJS path is correct');
      passed++;
    } else {
      console.error('   ✗ PeerJS path is incorrect');
      failed++;
    }
    
    // Test static files
    console.log('\nTesting static files...');
    await testEndpoint('/');
    console.log('   ✓ Index.html is served');
    passed++;
    
    // Test SPA fallback
    console.log('\nTesting SPA fallback...');
    await testEndpoint('/some-random-route');
    console.log('   ✓ SPA fallback works');
    passed++;

    // Test WebSocket signaling connection
    console.log('\nTesting WebSocket signaling connection...');
    await new Promise((resolve, reject) => {
      const wsUrl = BASE_URL.replace(/^http/, 'ws') + '/peerjs/ws';
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket connection timeout'));
      }, 3000);

      ws.on('open', () => {
        clearTimeout(timer);
        console.log('   ✓ WebSocket connected to signaling server');
        passed++;
        ws.close();
        resolve();
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        console.error('   ✗ WebSocket error:', err.message);
        failed++;
        reject(err);
      });
    });

    // Test WebSocket room join with initial mute & deafen state
    console.log('\nTesting room join with initial mute & deafen state...');
    await new Promise((resolve, reject) => {
      const wsUrl = BASE_URL.replace(/^http/, 'ws') + '/peerjs/ws';
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('Join test timeout'));
      }, 3000);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'join',
          roomId: 'test-room-123',
          peerId: 'peer-test-1',
          nickname: 'Tester',
          isMuted: true,
          isDeafened: true,
        }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'room-state') {
            clearTimeout(timer);
            console.log('   ✓ Room state received after join with initial mute/deafen');
            passed++;
            ws.close();
            resolve();
          }
        } catch (e) {
          clearTimeout(timer);
          reject(e);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        console.error('   ✗ WebSocket join error:', err.message);
        failed++;
        reject(err);
      });
    });
    
  } catch (error) {
    failed++;
    console.error('\n❌ Test failed:', error.message);
  }
  
  console.log('\n=========================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('=========================\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
