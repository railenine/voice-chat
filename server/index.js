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
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
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
  console.log(`[PeerJS] Client disconnected: ${client.getId()}`);
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
