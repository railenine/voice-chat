import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Health & Info endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'voicechat-server',
    version: '2.0.0'
  });
});

app.get('/peerjs/info', (req, res) => {
  res.json({
    name: 'VoiceChat Server',
    version: '2.0.0',
    signaling: 'websocket',
    path: '/peerjs/ws',
    status: 'running'
  });
});

// In-memory room manager
// roomId -> Map<peerId, { ws: WebSocket, peerId: string, nickname: string, isMuted: boolean, isSpeaking: boolean }>
const rooms = new Map();
// ws -> { roomId: string, peerId: string }
const clientMeta = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
}

function broadcastToRoom(roomId, message, excludePeerId = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = typeof message === 'string' ? message : JSON.stringify(message);
  for (const [peerId, client] of room.entries()) {
    if (peerId !== excludePeerId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(data);
      } catch (err) {
        console.warn(`[WS] Failed to send message to ${peerId}:`, err);
      }
    }
  }
}

function removeClientFromRoom(ws) {
  const meta = clientMeta.get(ws);
  if (!meta) return;

  const { roomId, peerId } = meta;
  clientMeta.delete(ws);

  const room = rooms.get(roomId);
  if (room && room.has(peerId)) {
    room.delete(peerId);
    console.log(`[Room ${roomId}] Peer ${peerId} left. Remaining: ${room.size}`);

    broadcastToRoom(roomId, {
      type: 'user-left',
      peerId
    });

    if (room.size === 0) {
      rooms.delete(roomId);
      console.log(`[Room ${roomId}] Room closed (empty)`);
    }
  }
}

// WebSocket Server attached to HTTP server
const wss = new WebSocketServer({ noServer: true });

// Handle upgrade for paths starting with /peerjs
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, 'http://localhost').pathname : '';
  
  // Accept both /peerjs/ws and /peerjs (and any subpath like /peerjs/peerjs for compatibility)
  if (pathname.startsWith('/peerjs')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');

  // Keep-alive ping
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      console.warn('[WS] Invalid JSON received:', raw.toString());
      return;
    }

    const { type } = msg;

    if (type === 'join') {
      const { roomId, peerId, nickname } = msg;
      if (!roomId || !peerId) {
        ws.send(JSON.stringify({ type: 'error', message: 'roomId and peerId are required' }));
        return;
      }

      // Cleanup any previous room for this socket
      removeClientFromRoom(ws);

      clientMeta.set(ws, { roomId, peerId });
      const room = getRoom(roomId);

      // Existing peers list (excluding self)
      const existingPeers = [];
      for (const [existingId, client] of room.entries()) {
        existingPeers.push({
          peerId: existingId,
          nickname: client.nickname,
          isMuted: client.isMuted,
          isSpeaking: client.isSpeaking,
        });
      }

      // Add client to room
      room.set(peerId, {
        ws,
        peerId,
        nickname: nickname || 'Аноним',
        isMuted: false,
        isSpeaking: false,
      });

      console.log(`[Room ${roomId}] Peer ${peerId} (${nickname}) joined. Total peers: ${room.size}`);

      // Send existing peers to joining client
      ws.send(JSON.stringify({
        type: 'room-state',
        peers: existingPeers,
      }));

      // Broadcast user-joined to all other peers in the room
      broadcastToRoom(roomId, {
        type: 'user-joined',
        peer: {
          peerId,
          nickname: nickname || 'Аноним',
          isMuted: false,
          isSpeaking: false,
        },
      }, peerId);

      return;
    }

    // WebRTC Signaling forwarding (offer, answer, candidate)
    if (type === 'signal') {
      const { to, data } = msg;
      const meta = clientMeta.get(ws);
      if (!meta || !to || !data) return;

      const room = rooms.get(meta.roomId);
      if (room && room.has(to)) {
        const targetClient = room.get(to);
        if (targetClient.ws.readyState === WebSocket.OPEN) {
          targetClient.ws.send(JSON.stringify({
            type: 'signal',
            from: meta.peerId,
            data,
          }));
        }
      }
      return;
    }

    // Update nickname in room
    if (type === 'update-nickname') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const { nickname } = msg;
      if (!nickname || typeof nickname !== 'string') return;

      const room = rooms.get(meta.roomId);
      if (room && room.has(meta.peerId)) {
        const client = room.get(meta.peerId);
        client.nickname = nickname.trim().substring(0, 32) || 'Аноним';

        console.log(`[Room ${meta.roomId}] Peer ${meta.peerId} changed nickname to: ${client.nickname}`);

        broadcastToRoom(meta.roomId, {
          type: 'user-updated',
          peerId: meta.peerId,
          nickname: client.nickname,
        });
      }
      return;
    }

    // Update mute status
    if (type === 'update-mute') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const { isMuted } = msg;
      const room = rooms.get(meta.roomId);
      if (room && room.has(meta.peerId)) {
        const client = room.get(meta.peerId);
        client.isMuted = Boolean(isMuted);

        broadcastToRoom(meta.roomId, {
          type: 'user-muted',
          peerId: meta.peerId,
          isMuted: client.isMuted,
        }, meta.peerId);
      }
      return;
    }

    // Speaking activity (VAD)
    if (type === 'speaking') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const { isSpeaking } = msg;
      const room = rooms.get(meta.roomId);
      if (room && room.has(meta.peerId)) {
        const client = room.get(meta.peerId);
        client.isSpeaking = Boolean(isSpeaking);

        broadcastToRoom(meta.roomId, {
          type: 'user-speaking',
          peerId: meta.peerId,
          isSpeaking: client.isSpeaking,
        }, meta.peerId);
      }
      return;
    }

    // Explicit leave
    if (type === 'leave') {
      removeClientFromRoom(ws);
      return;
    }
  });

  ws.on('close', () => {
    removeClientFromRoom(ws);
  });

  ws.on('error', (err) => {
    console.warn('[WS] Socket error:', err);
    removeClientFromRoom(ws);
  });
});

// Periodic ping interval (every 30s) to keep connections alive through proxies
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      removeClientFromRoom(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(pingInterval);
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
║   🎤 VoiceChat Server 2.0 (Pure WebRTC + WS)             ║
║                                                           ║
║   📡 WebSocket Signaling: ws://localhost:${PORT}/peerjs/ws   ║
║   🌐 Web App:             http://localhost:${PORT}           ║
║   ❤️  Health Check:        http://localhost:${PORT}/health    ║
║                                                           ║
║   Press Ctrl+C to stop                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  clearInterval(pingInterval);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  clearInterval(pingInterval);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
