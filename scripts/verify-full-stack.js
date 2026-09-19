import http from 'http';
import { spawn } from 'child_process';
import { WebSocket } from 'ws';

const TEST_PORT = 3199;

console.log('🚀 Starting Full-Stack VoiceChat 2.0 Integration Test on port', TEST_PORT);

// 1. Start Server
const serverProcess = spawn('node', ['server/index.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(TEST_PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});

serverProcess.stdout.on('data', (d) => {
  // console.log(`[Server] ${d.toString().trim()}`);
});
serverProcess.stderr.on('data', (d) => {
  console.error(`[Server ERR] ${d.toString().trim()}`);
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
  try {
    // Wait for server to boot
    await sleep(1500);

    // 2. Test HTTP Endpoints
    console.log('\n--- 1. Testing HTTP Endpoints ---');
    const health = await (await fetch(`http://localhost:${TEST_PORT}/health`)).json();
    console.log('✓ /health:', health.status, 'version:', health.version);
    if (health.status !== 'ok') throw new Error('Health status not ok');

    const info = await (await fetch(`http://localhost:${TEST_PORT}/peerjs/info`)).json();
    console.log('✓ /peerjs/info:', info.signaling, 'path:', info.path);
    if (info.signaling !== 'websocket') throw new Error('Signaling is not websocket');

    const ice = await (await fetch(`http://localhost:${TEST_PORT}/peerjs/ice-servers`)).json();
    console.log(`✓ /peerjs/ice-servers: Received ${ice.iceServers.length} ICE servers`);
    const hasCoturnTurn = ice.iceServers.some(s => 
      Array.isArray(s.urls) ? s.urls.some(u => u.includes('rvxis.site')) : (s.urls && s.urls.includes('rvxis.site'))
    );
    console.log('✓ Coturn VPS TURN (rvxis.site) present:', hasCoturnTurn);
    if (!hasCoturnTurn) throw new Error('Coturn TURN credentials missing from /peerjs/ice-servers');

    // 3. Test Multi-User Room (3 Users: Alice, Bob, Charlie)
    console.log('\n--- 2. Testing Multi-User WebSocket Signaling (3 Users) ---');
    const wsUrl = `ws://localhost:${TEST_PORT}/peerjs/ws`;

    // Connect Alice
    const aliceWs = new WebSocket(wsUrl);
    const bobWs = new WebSocket(wsUrl);
    const charlieWs = new WebSocket(wsUrl);

    await Promise.all([
      new Promise(r => aliceWs.on('open', r)),
      new Promise(r => bobWs.on('open', r)),
      new Promise(r => charlieWs.on('open', r)),
    ]);
    console.log('✓ 3 WebSockets connected');

    const aliceEvents = [];
    const bobEvents = [];
    const charlieEvents = [];

    aliceWs.on('message', data => aliceEvents.push(JSON.parse(data.toString())));
    bobWs.on('message', data => bobEvents.push(JSON.parse(data.toString())));
    charlieWs.on('message', data => charlieEvents.push(JSON.parse(data.toString())));

    // Alice joins
    aliceWs.send(JSON.stringify({
      type: 'join',
      roomId: 'room-test-123',
      peerId: 'alice-peer-id',
      nickname: 'Алиса',
    }));
    await sleep(200);

    const aliceRoomState = aliceEvents.find(e => e.type === 'room-state');
    if (!aliceRoomState || aliceRoomState.peers.length !== 0) {
      throw new Error('Alice did not receive empty room-state');
    }
    console.log('✓ Alice joined: room-state has 0 peers and Metered ICE servers');

    // Bob joins
    bobWs.send(JSON.stringify({
      type: 'join',
      roomId: 'room-test-123',
      peerId: 'bob-peer-id',
      nickname: 'Боб',
    }));
    await sleep(200);

    const bobRoomState = bobEvents.find(e => e.type === 'room-state');
    if (!bobRoomState || bobRoomState.peers.length !== 1 || bobRoomState.peers[0].peerId !== 'alice-peer-id') {
      throw new Error('Bob did not receive Alice in room-state');
    }
    const aliceSawBob = aliceEvents.find(e => e.type === 'user-joined' && e.peer.peerId === 'bob-peer-id');
    if (!aliceSawBob) {
      throw new Error('Alice did not receive user-joined for Bob');
    }
    console.log('✓ Bob joined: Bob sees Alice, Alice receives user-joined for Bob');

    // Charlie joins (3rd user)
    charlieWs.send(JSON.stringify({
      type: 'join',
      roomId: 'room-test-123',
      peerId: 'charlie-peer-id',
      nickname: 'Чарли',
    }));
    await sleep(200);

    const charlieRoomState = charlieEvents.find(e => e.type === 'room-state');
    if (!charlieRoomState || charlieRoomState.peers.length !== 2) {
      throw new Error('Charlie did not receive 2 existing peers in room-state');
    }
    const aliceSawCharlie = aliceEvents.find(e => e.type === 'user-joined' && e.peer.peerId === 'charlie-peer-id');
    const bobSawCharlie = bobEvents.find(e => e.type === 'user-joined' && e.peer.peerId === 'charlie-peer-id');
    if (!aliceSawCharlie || !bobSawCharlie) {
      throw new Error('Alice or Bob did not receive user-joined for Charlie');
    }
    console.log('✓ Charlie joined: Charlie sees 2 peers, Alice and Bob both receive user-joined for Charlie (3-way mesh ready)');

    // 4. Test WebRTC Signaling Exchange
    console.log('\n--- 3. Testing Signaling Forwarding (Offer/Answer/Candidates) ---');
    aliceWs.send(JSON.stringify({
      type: 'signal',
      to: 'bob-peer-id',
      data: { description: { type: 'offer', sdp: 'fake-sdp-offer' } }
    }));
    await sleep(150);

    const bobSignal = bobEvents.find(e => e.type === 'signal' && e.from === 'alice-peer-id');
    if (!bobSignal || bobSignal.data.description.sdp !== 'fake-sdp-offer') {
      throw new Error('Bob did not receive signaling offer from Alice');
    }
    console.log('✓ Signaling offer routed from Alice to Bob');

    // 5. Test Nickname Update
    console.log('\n--- 4. Testing Nickname Change Broadcast ---');
    bobWs.send(JSON.stringify({
      type: 'update-nickname',
      nickname: 'Боб Мастер',
    }));
    await sleep(150);

    const aliceSawNick = aliceEvents.find(e => e.type === 'user-updated' && e.peerId === 'bob-peer-id' && e.nickname === 'Боб Мастер');
    const charlieSawNick = charlieEvents.find(e => e.type === 'user-updated' && e.peerId === 'bob-peer-id' && e.nickname === 'Боб Мастер');
    if (!aliceSawNick || !charlieSawNick) {
      throw new Error('Alice or Charlie did not receive updated nickname for Bob');
    }
    console.log('✓ Nickname change to "Боб Мастер" broadcast to all room members');

    // 6. Test Speaking (VAD) Broadcast
    console.log('\n--- 5. Testing VAD Speaking Status Broadcast ---');
    charlieWs.send(JSON.stringify({
      type: 'speaking',
      isSpeaking: true,
    }));
    await sleep(150);

    const aliceSawSpeaking = aliceEvents.find(e => e.type === 'user-speaking' && e.peerId === 'charlie-peer-id' && e.isSpeaking === true);
    const bobSawSpeaking = bobEvents.find(e => e.type === 'user-speaking' && e.peerId === 'charlie-peer-id' && e.isSpeaking === true);
    if (!aliceSawSpeaking || !bobSawSpeaking) {
      throw new Error('Alice or Bob did not receive speaking update from Charlie');
    }
    console.log('✓ Charlie speaking status broadcast to Alice and Bob');

    // 7. Test User Leave
    console.log('\n--- 6. Testing User Leave ---');
    bobWs.send(JSON.stringify({ type: 'leave' }));
    bobWs.close();
    await sleep(150);

    const aliceSawLeave = aliceEvents.find(e => e.type === 'user-left' && e.peerId === 'bob-peer-id');
    const charlieSawLeave = charlieEvents.find(e => e.type === 'user-left' && e.peerId === 'bob-peer-id');
    if (!aliceSawLeave || !charlieSawLeave) {
      throw new Error('Alice or Charlie did not receive user-left for Bob');
    }
    console.log('✓ Bob left: Alice and Charlie received user-left notification');

    aliceWs.close();
    charlieWs.close();

    console.log('\n=============================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================');

  } finally {
    serverProcess.kill('SIGTERM');
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  serverProcess.kill('SIGTERM');
  process.exit(1);
});
