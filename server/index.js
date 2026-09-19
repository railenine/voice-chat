import express from 'express';
import { ExpressPeerServer } from 'peer';
import http from 'http';
import cors from 'cors';

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

// PeerJS signaling server
// ПРАВИЛЬНАЯ КОНФИГУРАЦИЯ:
// path: '/' означает, что сервер обрабатывает запросы относительно точки монтирования.
const peerServer = ExpressPeerServer(server, {
  debug: 2,
  path: '/', 
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

// Монтируем PeerJS именно по пути /peerjs
app.use('/peerjs', peerServer);

// Логирование событий PeerJS
peerServer.on('connection', (client) => {
  console.log(`[PeerJS] Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`[PeerJS] Client disconnected: ${client.getId()}`);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎤 VoiceChat Server is running!                        ║
║                                                           ║
║   📡 PeerJS Signaling: http://localhost:${PORT}/peerjs      ║
║   ❤️  Health Check:     http://localhost:${PORT}/health     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
