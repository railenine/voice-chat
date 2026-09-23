import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

const APP_VERSION = '0.0.48';
const MIN_CLIENT_VERSION = '0.0.3';

// Health & Info endpoints
app.get(['/health', '/peerjs/health'], (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'voicechat-server',
    version: APP_VERSION,
    minClientVersion: MIN_CLIENT_VERSION
  });
});

app.get('/peerjs/info', (req, res) => {
  res.json({
    name: 'VoiceChat Server',
    version: APP_VERSION,
    signaling: 'websocket',
    path: '/peerjs/ws',
    status: 'running'
  });
});

// Tauri updater endpoint: serves latest.json manifest for desktop clients
// Proxies directly to GitHub Releases latest download with 60s cache
let cachedManifest = null;
let cachedManifestTime = 0;

let localFallbackManifest = null;
const latestJsonPath = path.join(__dirname, 'latest.json');
try {
  if (fs.existsSync(latestJsonPath)) {
    localFallbackManifest = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
  }
} catch (e) {
  console.warn('[Server] Could not parse local latest.json fallback:', e.message);
}

app.get(['/peerjs/updater/latest.json', '/api/updater/latest.json', '/downloads/latest.json'], async (req, res) => {
  const now = Date.now();
  if (cachedManifest && now - cachedManifestTime < 60000) {
    return res.json(cachedManifest);
  }

  try {
    const ghUrl = 'https://github.com/railenine/voice-chat/releases/latest/download/latest.json';
    const response = await fetch(ghUrl, {
      headers: { 'User-Agent': 'VoiceChat-Server-Updater' }
    });
    if (response.ok) {
      const data = await response.json();
      cachedManifest = data;
      cachedManifestTime = now;
      return res.json(data);
    }
  } catch (err) {
    console.warn('[Updater] Failed to proxy latest.json from GitHub Releases:', err.message);
  }

  if (localFallbackManifest) {
    return res.json(localFallbackManifest);
  }

  // Default fallback manifest
  res.json({
    version: APP_VERSION,
    notes: `VoiceChat v${APP_VERSION} - P2P WebRTC Voice Chat`,
    pub_date: new Date().toISOString(),
    portable_url: `https://github.com/railenine/voice-chat/releases/download/v${APP_VERSION}/voice-chat.exe`,
    platforms: {
      'windows-x86_64': {
        url: `https://github.com/railenine/voice-chat/releases/download/v${APP_VERSION}/VoiceChat_${APP_VERSION}_x64-setup.exe`
      }
    }
  });
});

// Coturn TURN/STUN configuration (VPS rvxis.site)
const COTURN_DOMAIN = process.env.COTURN_DOMAIN || 'rvxis.site';
const COTURN_PORT = process.env.COTURN_PORT || 3478;
const COTURN_TLS_PORT = process.env.COTURN_TLS_PORT || 5349;
const COTURN_USER = process.env.COTURN_USER || 'voicechat';
const COTURN_PASSWORD = process.env.COTURN_PASSWORD || 'VoiceChatSecret2026!';

const CACHED_ICE_SERVERS = Object.freeze([
  // VPS Dedicated STUN
  { urls: `stun:${COTURN_DOMAIN}:${COTURN_PORT}` },
  // VPS Dedicated TURN (UDP, TCP, and TURNS over TLS)
  {
    urls: [
      `turn:${COTURN_DOMAIN}:${COTURN_PORT}?transport=udp`,
      `turn:${COTURN_DOMAIN}:${COTURN_PORT}?transport=tcp`,
      `turns:${COTURN_DOMAIN}:${COTURN_TLS_PORT}?transport=tcp`,
    ],
    username: COTURN_USER,
    credential: COTURN_PASSWORD,
  },
  // Public Fallback STUNs
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },
]);

function getIceServers() {
  return CACHED_ICE_SERVERS;
}

app.get('/peerjs/ice-servers', (req, res) => {
  res.json({ iceServers: CACHED_ICE_SERVERS });
});

// In-memory room manager
// roomId -> Map<peerId, { ws: WebSocket, peerId: string, nickname: string, isMuted: boolean, isSpeaking: boolean }>
const rooms = new Map();
// ws -> { roomId: string, peerId: string }
const clientMeta = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    const room = new Map();
    room.messages = [];
    rooms.set(roomId, room);
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
      console.log(`[Room ${roomId}] Room closed (empty, all in-memory messages cleared)`);
    }
  }
}

// WebSocket Server attached to HTTP server (with 64KB maxPayload protection against OOM)
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

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

// In-memory sliding-window rate limiter per socket (max 25 messages per 1000ms window)
const RATE_LIMIT_MAX_MSG = 25;
const RATE_LIMIT_WINDOW_MS = 1000;

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');

  ws.msgCount = 0;
  ws.lastMsgReset = Date.now();

  // Keep-alive ping
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (raw) => {
    const now = Date.now();
    if (now - ws.lastMsgReset > RATE_LIMIT_WINDOW_MS) {
      ws.msgCount = 1;
      ws.lastMsgReset = now;
    } else {
      ws.msgCount++;
      if (ws.msgCount > RATE_LIMIT_MAX_MSG) {
        if (ws.msgCount === RATE_LIMIT_MAX_MSG + 1) {
          console.warn(`[WS] Rate limit exceeded for socket (${ws.msgCount} msgs/s). Throttling.`);
          try {
            ws.send(JSON.stringify({ type: 'error', message: 'Слишком много запросов. Подождите секунду.' }));
          } catch (e) {}
        }
        return; // Drop packet
      }
    }

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      const rawSnippet = String(raw).slice(0, 100);
      console.warn('[WS] Invalid JSON received:', rawSnippet);
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

      const room = getRoom(roomId);

      // Check if room already has stale clients with the same peerId OR the same non-default nickname
      const cleanNick = (nickname || '').trim();
      const isNonDefaultNick = cleanNick && cleanNick !== 'Аноним';
      const stalePeers = [];

      for (const [existingId, client] of room.entries()) {
        const isSamePeer = existingId === peerId;
        const isSameNick = isNonDefaultNick && client.nickname === cleanNick;
        if (isSamePeer || isSameNick) {
          stalePeers.push({ peerId: existingId, client });
        }
      }

      for (const { peerId: staleId, client: staleClient } of stalePeers) {
        console.log(`[Room ${roomId}] Evicting stale duplicate peer ${staleId} (${staleClient.nickname})`);
        try {
          staleClient.ws.close();
        } catch (e) {}
        clientMeta.delete(staleClient.ws);
        room.delete(staleId);
        broadcastToRoom(roomId, {
          type: 'user-left',
          peerId: staleId,
        });
      }

      clientMeta.set(ws, { roomId, peerId });

      // Existing peers list (excluding self)
      const existingPeers = [];
      for (const [existingId, client] of room.entries()) {
        existingPeers.push({
          peerId: existingId,
          nickname: client.nickname,
          isMuted: client.isMuted,
          isDeafened: client.isDeafened || false,
          isSpeaking: client.isSpeaking,
        });
      }

      // Add client to room
      room.set(peerId, {
        ws,
        peerId,
        nickname: nickname || 'Аноним',
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
      });

      console.log(`[Room ${roomId}] Peer ${peerId} (${nickname}) joined. Total peers: ${room.size}`);

      // Send existing peers, in-memory messages, and iceServers to joining client
      ws.send(JSON.stringify({
        type: 'room-state',
        peers: existingPeers,
        messages: room.messages || [],
        iceServers: CACHED_ICE_SERVERS,
      }));

      // Broadcast user-joined to all other peers in the room
      broadcastToRoom(roomId, {
        type: 'user-joined',
        peer: {
          peerId,
          nickname: nickname || 'Аноним',
          isMuted: false,
          isDeafened: false,
          isSpeaking: false,
        },
        iceServers: CACHED_ICE_SERVERS,
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
          // Backpressure guard: drop signal if client output buffer is severely backlogged
          if (targetClient.ws.bufferedAmount > 512 * 1024) {
            console.warn(`[WS] Dropping signal to ${to}: buffer clogged (${targetClient.ws.bufferedAmount} bytes)`);
            return;
          }
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

    // Update deafen status (mute both mic and all sound)
    if (type === 'update-deafen') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const { isDeafened } = msg;
      const room = rooms.get(meta.roomId);
      if (room && room.has(meta.peerId)) {
        const client = room.get(meta.peerId);
        client.isDeafened = Boolean(isDeafened);
        if (client.isDeafened) {
          client.isMuted = true;
          client.isSpeaking = false;
        }

        broadcastToRoom(meta.roomId, {
          type: 'user-deafened',
          peerId: meta.peerId,
          isDeafened: client.isDeafened,
        }, meta.peerId);
      }
      return;
    }

    // Speaking activity (VAD)
    if (type === 'speaking') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const isSpeaking = Boolean(msg.isSpeaking);
      const room = rooms.get(meta.roomId);
      if (room && room.has(meta.peerId)) {
        const client = room.get(meta.peerId);
        // Optimize: Only broadcast when speaking state actually transitions!
        if (client.isSpeaking === isSpeaking) {
          return;
        }
        client.isSpeaking = isSpeaking;

        broadcastToRoom(meta.roomId, {
          type: 'user-speaking',
          peerId: meta.peerId,
          isSpeaking,
        }, meta.peerId);
      }
      return;
    }

    // In-room Chat message (zero persistence, in-memory only)
    if (type === 'chat-message') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const { text } = msg;
      if (!text || typeof text !== 'string') return;
      const trimmedText = text.trim();
      if (!trimmedText || trimmedText.length > 1000) return;

      const room = rooms.get(meta.roomId);
      if (!room || !room.has(meta.peerId)) return;

      const client = room.get(meta.peerId);
      const chatMessage = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        peerId: meta.peerId,
        nickname: client.nickname || 'Аноним',
        text: trimmedText,
        timestamp: Date.now(),
      };

      if (!room.messages) {
        room.messages = [];
      }
      room.messages.push(chatMessage);
      // Keep only last 100 messages in memory per room
      if (room.messages.length > 100) {
        room.messages.splice(0, room.messages.length - 100);
      }

      broadcastToRoom(meta.roomId, {
        type: 'chat-message',
        message: chatMessage,
      });
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

// Serve static files from dist with HTTP caching headers
if (fs.existsSync(distPath)) {
  const assetsPath = path.join(distPath, 'assets');
  if (fs.existsSync(assetsPath)) {
    // Immutable cache for content-hashed Vite assets (1 year)
    app.use('/assets', express.static(assetsPath, {
      maxAge: '1y',
      immutable: true,
    }));
  }

  // General static assets (favicon, manifest, etc.)
  app.use(express.static(distPath, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // SPA fallback for all other routes (always fresh index.html)
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`[Static] Serving frontend with immutable assets cache from ${distPath}`);
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
