import express from 'express';
import { ExpressPeerServer } from 'peer';
import http from 'http';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'voicechat-server'
  });
});

// ПРАВИЛЬНАЯ КОНФИГУРАЦИЯ PeerJS v1.x
// Мы явно указываем path: '/peerjs' и монтируем на '/peerjs'
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

// Монтируем сервер
app.use('/peerjs', peerServer);

peerServer.on('connection', (client) => {
  console.log(`[PeerJS] Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`[PeerJS] Client disconnected: ${client.getId()}`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎤 VoiceChat Server is running on port ${PORT}`);
  console.log(`📡 PeerJS: http://localhost:${PORT}/peerjs`);
});
