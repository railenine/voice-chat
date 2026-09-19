import express from 'express';
import { ExpressPeerServer } from 'peer';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'voicechat-server'
  });
});

// API info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'VoiceChat Server',
    version: '1.0.0',
    peerServer: '/peerjs',
    status: 'running'
  });
});

// In-memory room registry
// roomId -> Map<peerId, { peerId, nickname, lastSeen: number }>
const rooms = new Map();

function getActiveRoomPeers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  const now = Date.now();
  const activePeers = [];
  for (const [peerId, peer] of room.entries()) {
    if (now - peer.lastSeen > 15000) {
      room.delete(peerId);
    } else {
      activePeers.push({ peerId: peer.peerId, nickname: peer.nickname });
    }
  }
  if (room.size === 0) {
    rooms.delete(roomId);
  }
  return activePeers;
}

// Room endpoints (under /peerjs/rooms to ensure Nginx proxies them to Node)
app.post('/peerjs/rooms/:roomId/join', (req, res) => {
  const { roomId } = req.params;
  const { peerId, nickname } = req.body;
  if (!peerId) {
    return res.status(400).json({ error: 'peerId is required' });
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  const room = rooms.get(roomId);
  room.set(peerId, {
    peerId,
    nickname: nickname || 'Аноним',
    lastSeen: Date.now()
  });

  const peers = getActiveRoomPeers(roomId).filter(p => p.peerId !== peerId);
  console.log(`[Rooms] Peer ${peerId} (${nickname}) joined room ${roomId}. Active peers: ${peers.length}`);
  res.json({ peers });
});

app.post('/peerjs/rooms/:roomId/heartbeat', (req, res) => {
  const { roomId } = req.params;
  const { peerId } = req.body;
  const room = rooms.get(roomId);
  if (room && peerId && room.has(peerId)) {
    room.get(peerId).lastSeen = Date.now();
  }
  const peers = getActiveRoomPeers(roomId).filter(p => p.peerId !== peerId);
  res.json({ peers });
});

app.post('/peerjs/rooms/:roomId/leave', (req, res) => {
  const { roomId } = req.params;
  const { peerId } = req.body;
  const room = rooms.get(roomId);
  if (room && peerId) {
    room.delete(peerId);
    if (room.size === 0) rooms.delete(roomId);
    console.log(`[Rooms] Peer ${peerId} left room ${roomId}`);
  }
  res.json({ status: 'ok' });
});

// PeerJS signaling server
// CORRECT CONFIGURATION:
// - path: '/peerjs' - полный путь для PeerJS
// - app.use(peerServer) - без mount point
// - HTTP: /peerjs/id, /peerjs/peers
// - WebSocket: /peerjs/peerjs
const peerServer = ExpressPeerServer(server, {
  debug: 2,
  path: '/peerjs',
  allow_discovery: true,
  concurrent_limit: 10000,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ]
  }
});

// Mount PeerJS WITHOUT mount point (important!)
app.use(peerServer);

// Peer events logging
peerServer.on('connection', (client) => {
  console.log(`[PeerJS] Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  const peerId = client.getId();
  console.log(`[PeerJS] Client disconnected: ${peerId}`);
  for (const [roomId, room] of rooms.entries()) {
    if (room.has(peerId)) {
      room.delete(peerId);
      if (room.size === 0) rooms.delete(roomId);
      console.log(`[Rooms] Cleaned up disconnected peer ${peerId} from room ${roomId}`);
    }
  }
});

// Serve static files from dist if available
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`[Static] Serving frontend from ${distPath}`);
} else {
  console.log('[Static] Dist folder not found, running in API/Signaling mode only');
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎤 VoiceChat Server is running!                        ║
║                                                           ║
║   📡 PeerJS Signaling: ws://localhost:${PORT}/peerjs        ║
║   🌐 Web App:          http://localhost:${PORT}              ║
║   ❤️  Health Check:     http://localhost:${PORT}/health       ║
║                                                           ║
║   Press Ctrl+C to stop                                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
