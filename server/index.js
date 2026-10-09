import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { AccessToken } from 'livekit-server-sdk';
import {
  ROOM_ID_REGEX,
  PEER_ID_REGEX,
  sanitizeNickname,
  validateClientMessage,
  createProtocolError,
} from './protocol.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

// Load .env file if present (native zero-dependency parser)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

const app = express();
const server = http.createServer(app);

// CORS configuration: support whitelist via CORS_ORIGIN env, with sensible safe defaults
const rawCorsOrigin = process.env.CORS_ORIGIN;
let corsMiddleware;

if (rawCorsOrigin && rawCorsOrigin !== '*') {
  const allowedOrigins = rawCorsOrigin.split(',').map((s) => s.trim().toLowerCase());
  corsMiddleware = cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const lower = origin.toLowerCase();
      const isAllowed = allowedOrigins.some((allowed) => {
        return (
          lower === allowed ||
          lower.startsWith('tauri://') ||
          lower.startsWith('http://tauri.') ||
          (!IS_PROD && (lower.includes('localhost') || lower.includes('127.0.0.1')))
        );
      });
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  });
} else if (IS_PROD) {
  // Production default when CORS_ORIGIN is not explicitly specified
  corsMiddleware = cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const lower = origin.toLowerCase();
      if (
        lower.includes('rvxis.site') ||
        lower.startsWith('tauri://') ||
        lower.startsWith('http://tauri.')
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  });
} else {
  // Development / Test mode default: permissive
  corsMiddleware = cors();
}

app.use(corsMiddleware);
// Body parser: strictly limit payload size to 10kb to prevent memory DoS attacks
app.use(express.json({ limit: '10kb' }));

const APP_VERSION = '0.1.15';
const MIN_CLIENT_VERSION = '0.0.3';

// Health & Info endpoints
app.get(['/health', '/peerjs/health'], (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'rvxis-server',
    version: APP_VERSION,
    minClientVersion: MIN_CLIENT_VERSION
  });
});

app.get(['/api/info', '/peerjs/info'], (req, res) => {
  res.json({
    name: 'RVxis Server',
    version: APP_VERSION,
    peerServer: '/peerjs',
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

app.get('/downloads/RVxis.exe', (req, res) => {
  const exePath = path.join(__dirname, '..', 'RVxis.exe');
  if (fs.existsSync(exePath)) {
    return res.sendFile(exePath);
  }
  res.status(404).send('RVxis.exe not found');
});

app.get(['/peerjs/updater/latest.json', '/api/updater/latest.json', '/downloads/latest.json'], async (req, res) => {
  // In local development / testing mode, always serve fresh local server/latest.json
  if (!IS_PROD) {
    try {
      if (fs.existsSync(latestJsonPath)) {
        const fresh = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
        return res.json(fresh);
      }
    } catch (e) {
      console.warn('[Server] Error reading local latest.json:', e.message);
    }
  }

  const now = Date.now();
  if (cachedManifest && now - cachedManifestTime < 60000) {
    return res.json(cachedManifest);
  }

  try {
    const ghUrl = 'https://github.com/railenine/voice-chat/releases/latest/download/latest.json';
    const response = await fetch(ghUrl, {
      headers: { 'User-Agent': 'RVxis-Server-Updater' }
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
    notes: `RVxis v${APP_VERSION} - P2P WebRTC Voice Chat`,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        url: `https://github.com/railenine/voice-chat/releases/download/v${APP_VERSION}/RVxis_${APP_VERSION}_x64-setup.exe`
      }
    },
    portable: {
      'windows-x86_64': {
        url: `https://github.com/railenine/voice-chat/releases/download/v${APP_VERSION}/RVxis.exe`
      }
    },
    portable_url: `https://github.com/railenine/voice-chat/releases/download/v${APP_VERSION}/RVxis.exe`
  });
});

// Coturn TURN/STUN configuration (VPS rvxis.site)
const COTURN_DOMAIN = process.env.COTURN_DOMAIN || 'rvxis.site';
const COTURN_PORT = parseInt(process.env.COTURN_PORT, 10) || 3478;
const COTURN_TLS_PORT = parseInt(process.env.COTURN_TLS_PORT, 10) || 5349;
const COTURN_USER = process.env.COTURN_USER || 'voicechat';
const COTURN_PASSWORD = process.env.COTURN_PASSWORD || '';
const COTURN_SHARED_SECRET = process.env.COTURN_SHARED_SECRET || '';

// LiveKit SFU Configuration & Token Endpoints
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'https://livekit.rvxis.site';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

// Security configuration validation helper
function validateServerConfig(env = process.env) {
  const currentEnv = env.NODE_ENV || 'development';
  const isProduction = currentEnv === 'production';
  const turnPassword = env.COTURN_PASSWORD || '';
  const turnSecret = env.COTURN_SHARED_SECRET || '';

  if (isProduction && !turnPassword && !turnSecret) {
    return {
      valid: false,
      error: 'In production mode, COTURN_PASSWORD or COTURN_SHARED_SECRET must be configured. Never use default fallback passwords!'
    };
  }

  const livekitKey = env.LIVEKIT_API_KEY || '';
  const livekitSecret = env.LIVEKIT_API_SECRET || '';
  if (isProduction && (Boolean(livekitKey) !== Boolean(livekitSecret))) {
    return {
      valid: false,
      error: 'Both LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set if LiveKit is enabled in production.'
    };
  }

  return { valid: true };
}

// Validate configuration on startup
const configCheck = validateServerConfig(process.env);
if (!configCheck.valid) {
  console.warn(`\n⚠️ [Server:Security] Config Notice: ${configCheck.error}`);
  console.warn('[Server:Security] Operating in safe STUN-only mode until credentials are provided in .env\n');
} else if (!IS_PROD && !COTURN_PASSWORD && !COTURN_SHARED_SECRET) {
  console.warn('[Server:Security] Notice: Running in development mode without COTURN_PASSWORD. Only public STUN servers will be provided.');
}

// Generates ICE servers with ephemeral (time-limited) HMAC credentials or static credentials
function getIceServers(peerId = 'voicechat') {
  const domain = process.env.COTURN_DOMAIN || 'rvxis.site';
  const port = parseInt(process.env.COTURN_PORT, 10) || 3478;
  const tlsPort = parseInt(process.env.COTURN_TLS_PORT, 10) || 5349;
  const user = process.env.COTURN_USER || 'voicechat';
  const password = process.env.COTURN_PASSWORD || '';
  const sharedSecret = process.env.COTURN_SHARED_SECRET || '';

  const stunServers = [
    { urls: `stun:${domain}:${port}` },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ];

  // 1. Ephemeral (time-limited) TURN credentials via HMAC-SHA1 (RFC 5766 REST API)
  if (sharedSecret) {
    const ttlSeconds = 86400; // 24 hours validity
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
    const cleanPeer = String(peerId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'voicechat';
    const ephemeralUser = `${expiry}:${cleanPeer}`;
    const ephemeralPassword = crypto
      .createHmac('sha1', sharedSecret)
      .update(ephemeralUser)
      .digest('base64');

    return [
      ...stunServers,
      {
        urls: `turn:${domain}:${port}?transport=udp`,
        username: ephemeralUser,
        credential: ephemeralPassword,
      },
      {
        urls: `turn:${domain}:${port}?transport=tcp`,
        username: ephemeralUser,
        credential: ephemeralPassword,
      },
      {
        urls: `turns:${domain}:${tlsPort}?transport=tcp`,
        username: ephemeralUser,
        credential: ephemeralPassword,
      },
    ];
  }

  // 2. Static TURN credentials (when COTURN_PASSWORD is explicitly set)
  if (password) {
    return [
      ...stunServers,
      {
        urls: `turn:${domain}:${port}?transport=udp`,
        username: user,
        credential: password,
      },
      {
        urls: `turn:${domain}:${port}?transport=tcp`,
        username: user,
        credential: password,
      },
      {
        urls: `turns:${domain}:${tlsPort}?transport=tcp`,
        username: user,
        credential: password,
      },
    ];
  }

  // 3. Fallback: return STUN-only in development/test if no credentials set
  return stunServers;
}

app.get('/peerjs/ice-servers', (req, res) => {
  const peerId = typeof req.query.peerId === 'string' ? req.query.peerId : 'client';
  res.json({ iceServers: getIceServers(peerId) });
});

// Status endpoint: tells clients if LiveKit SFU is enabled and configured
app.get(['/api/livekit/status', '/peerjs/livekit/status'], (req, res) => {
  res.json({
    available: Boolean(LIVEKIT_API_SECRET && LIVEKIT_API_KEY),
    url: LIVEKIT_URL,
  });
});

// Sliding-window in-memory IP rate limiter for Token endpoint
const tokenRateLimitWindowMs = 60 * 1000; // 1 minute
const maxTokenRequestsPerWindow = parseInt(process.env.RATE_LIMIT_TOKEN_PER_MINUTE, 10) || 20;
const tokenRequestCounts = new Map(); // ip -> { count: number, resetTime: number }

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of tokenRequestCounts.entries()) {
    if (now > entry.resetTime) {
      tokenRequestCounts.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

function tokenRateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = tokenRequestCounts.get(ip);

  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + tokenRateLimitWindowMs };
    tokenRequestCounts.set(ip, entry);
    return next();
  }

  entry.count++;
  if (entry.count > maxTokenRequestsPerWindow) {
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many token requests. Please wait a minute.'
    });
  }

  next();
}

// Note: ROOM_ID_REGEX, PEER_ID_REGEX, and sanitizeNickname are imported from ./protocol.js

// Token endpoint: generates a scoped JWT token for video screen sharing
app.post(['/api/livekit/token', '/peerjs/livekit/token'], tokenRateLimiter, async (req, res) => {
  const { roomId, nickname, peerId } = req.body || {};

  // Strict validation: roomId
  if (!roomId || typeof roomId !== 'string' || !ROOM_ID_REGEX.test(roomId.trim())) {
    return res.status(400).json({
      error: 'invalid_room_id',
      message: 'Room ID must be 3-64 characters and contain only letters, numbers, underscores, or hyphens'
    });
  }

  // Strict validation: peerId (if provided)
  if (peerId !== undefined && peerId !== null) {
    if (typeof peerId !== 'string' || !PEER_ID_REGEX.test(peerId.trim())) {
      return res.status(400).json({
        error: 'invalid_peer_id',
        message: 'Peer ID must be 3-64 characters and contain only letters, numbers, underscores, or hyphens'
      });
    }
  }

  // Graceful check if SFU credentials are configured
  const currentKey = process.env.LIVEKIT_API_KEY || '';
  const currentSecret = process.env.LIVEKIT_API_SECRET || '';
  if (!currentSecret || !currentKey) {
    return res.status(503).json({
      error: 'livekit_not_configured',
      message: 'LiveKit SFU screen sharing is not configured on this server'
    });
  }

  try {
    const cleanRoom = roomId.trim();
    const cleanNick = sanitizeNickname(nickname);
    const identity = (peerId && typeof peerId === 'string' ? peerId.trim() : crypto.randomUUID()).slice(0, 64);

    const at = new AccessToken(currentKey, currentSecret, {
      identity,
      name: cleanNick,
      ttl: '12h',
    });

    at.addGrant({
      roomJoin: true,
      room: cleanRoom,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    res.json({
      token,
      livekitUrl: LIVEKIT_URL,
      room: cleanRoom,
      identity,
    });
  } catch (err) {
    console.error('[LiveKit] Token generation error');
    // NEVER expose err.message or stack trace to client
    res.status(500).json({
      error: 'token_generation_failed',
      message: 'Failed to generate access token'
    });
  }
});

// In-memory room manager
// roomId -> Map<peerId, { ws: WebSocket, peerId: string, nickname: string, isMuted: boolean, isSpeaking: boolean }>
const rooms = new Map();
// ws -> { roomId: string, peerId: string }
const clientMeta = new Map();

// Maximum participants in a single Full-Mesh P2P room (default: 12)
export const MAX_ROOM_PEERS = parseInt(process.env.MAX_ROOM_PEERS, 10) || 12;

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    const room = new Map();
    room.messages = [];
    rooms.set(roomId, room);
  }
  return rooms.get(roomId);
}

function safeSend(socket, payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      socket.send(data);
      return true;
    } catch (err) {
      console.warn('[WS] Failed to send message to socket:', err.message);
      return false;
    }
  }
  return false;
}

function broadcastToRoom(roomId, message, excludePeerId = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = typeof message === 'string' ? message : JSON.stringify(message);
  for (const [peerId, client] of room.entries()) {
    if (peerId !== excludePeerId) {
      safeSend(client.ws, data);
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
      peerId,
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

// In-memory sliding-window rate limiter per socket
// WebRTC ICE candidate gathering bursts naturally emit 30-60 msgs/s during connection handshake.
const RATE_LIMIT_MAX_MSG = 100;
const RATE_LIMIT_HARD_CAP = 250;
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
    let rawMsg;
    try {
      rawMsg = JSON.parse(raw.toString());
    } catch (e) {
      const rawSnippet = String(raw).slice(0, 100);
      console.warn('[WS] Invalid JSON received:', rawSnippet);
      safeSend(ws, createProtocolError('invalid_message', 'Invalid JSON syntax'));
      return;
    }

    const { type } = rawMsg || {};

    // Rate limiter: exempt critical WebRTC signaling ('signal' for SDP/ICE) up to hard cap (250 msgs/s)
    const now = Date.now();
    if (now - ws.lastMsgReset > RATE_LIMIT_WINDOW_MS) {
      ws.msgCount = 1;
      ws.lastMsgReset = now;
    } else {
      ws.msgCount++;
      if (ws.msgCount > RATE_LIMIT_MAX_MSG) {
        const isCriticalSignal = type === 'signal';
        if (!isCriticalSignal || ws.msgCount > RATE_LIMIT_HARD_CAP) {
          if (ws.msgCount === RATE_LIMIT_MAX_MSG + 1 || ws.msgCount === RATE_LIMIT_HARD_CAP + 1) {
            console.warn(`[WS] Rate limit exceeded for socket (${ws.msgCount} msgs/s, type: ${type}). Throttling.`);
            safeSend(ws, createProtocolError('rate_limit_exceeded', 'Rate limit exceeded. Please slow down.'));
          }
          return; // Drop packet
        }
      }
    }

    const currentMeta = clientMeta.get(ws);
    const validation = validateClientMessage(rawMsg, currentMeta);
    if (!validation.valid) {
      safeSend(ws, createProtocolError(validation.code, validation.message));
      return;
    }

    const msg = validation.data;

    if (msg.type === 'join') {
      const { roomId, peerId, nickname, isMuted, isDeafened } = msg;

      // Cleanup any previous room for this socket
      removeClientFromRoom(ws);

      const room = getRoom(roomId);

      // Check if room already has a client with the same peerId (evict stale duplicate)
      const existingClient = room.get(peerId);
      const isReconnecting = Boolean(existingClient);

      // Room capacity policy for Full Mesh WebRTC stability:
      // If room is full and this is NOT a reconnecting client with the same peerId, reject join
      if (!isReconnecting && room.size >= MAX_ROOM_PEERS) {
        console.warn(`[Room ${roomId}] Join rejected for ${peerId}: room is full (${room.size}/${MAX_ROOM_PEERS})`);
        safeSend(
          ws,
          createProtocolError(
            'room_full',
            `Комната заполнена (максимум ${MAX_ROOM_PEERS} участников для прямого P2P-аудио)`
          )
        );
        return;
      }

      if (existingClient && existingClient.ws !== ws) {
        console.log(`[Room ${roomId}] Evicting existing connection for duplicate peerId ${peerId}`);
        try {
          existingClient.ws.close();
        } catch (e) {}
        clientMeta.delete(existingClient.ws);
        room.delete(peerId);
        broadcastToRoom(roomId, {
          type: 'user-left',
          peerId,
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

      room.set(peerId, {
        ws,
        peerId,
        nickname,
        isMuted,
        isDeafened,
        isSpeaking: false,
      });

      console.log(`[Room ${roomId}] Peer ${peerId} (${nickname}) joined. Total peers: ${room.size}`);

      // Send existing peers, in-memory messages, and iceServers to joining client
      safeSend(ws, {
        type: 'room-state',
        peers: existingPeers,
        messages: room.messages || [],
        iceServers: getIceServers(peerId),
      });

      // Broadcast user-joined to all other peers in the room
      broadcastToRoom(roomId, {
        type: 'user-joined',
        peer: {
          peerId,
          nickname,
          isMuted,
          isDeafened,
          isSpeaking: false,
        },
        iceServers: getIceServers(peerId),
      }, peerId);

      return;
    }

    if (msg.type === 'signal') {
      const { to, data } = msg;
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const room = rooms.get(meta.roomId);
      if (!room || !room.has(to)) {
        safeSend(ws, createProtocolError('target_not_found', `Peer ${to} not found in this room`));
        return;
      }

      const targetClient = room.get(to);
      if (targetClient.ws.readyState === WebSocket.OPEN) {
        // Backpressure guard: drop signal if client output buffer is severely backlogged
        if (targetClient.ws.bufferedAmount > 512 * 1024) {
          console.warn(`[WS] Dropping signal to ${to}: buffer clogged (${targetClient.ws.bufferedAmount} bytes)`);
          return;
        }
        safeSend(targetClient.ws, {
          type: 'signal',
          from: meta.peerId,
          data,
        });
      }
      return;
    }

    if (msg.type === 'update-nickname') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const room = rooms.get(meta.roomId);
      if (room && room.has(meta.peerId)) {
        const client = room.get(meta.peerId);
        client.nickname = msg.nickname;

        console.log(`[Room ${meta.roomId}] Peer ${meta.peerId} changed nickname to: ${client.nickname}`);

        broadcastToRoom(meta.roomId, {
          type: 'user-updated',
          peerId: meta.peerId,
          nickname: client.nickname,
        });
      }
      return;
    }

    if (msg.type === 'update-mute') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const room = rooms.get(meta.roomId);
      if (room && room.has(meta.peerId)) {
        const client = room.get(meta.peerId);
        client.isMuted = msg.isMuted;

        broadcastToRoom(meta.roomId, {
          type: 'user-muted',
          peerId: meta.peerId,
          isMuted: client.isMuted,
        }, meta.peerId);
      }
      return;
    }

    if (msg.type === 'update-deafen') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const room = rooms.get(meta.roomId);
      if (room && room.has(meta.peerId)) {
        const client = room.get(meta.peerId);
        client.isDeafened = msg.isDeafened;
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

    if (msg.type === 'speaking') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const room = rooms.get(meta.roomId);
      if (room && room.has(meta.peerId)) {
        const client = room.get(meta.peerId);
        if (client.isSpeaking === msg.isSpeaking) {
          return;
        }
        client.isSpeaking = msg.isSpeaking;

        broadcastToRoom(meta.roomId, {
          type: 'user-speaking',
          peerId: meta.peerId,
          isSpeaking: msg.isSpeaking,
        }, meta.peerId);
      }
      return;
    }

    if (msg.type === 'chat-message') {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const room = rooms.get(meta.roomId);
      if (!room || !room.has(meta.peerId)) return;

      const client = room.get(meta.peerId);
      const chatMessage = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        peerId: meta.peerId,
        nickname: client.nickname || 'Аноним',
        text: msg.text,
        timestamp: Date.now(),
      };

      if (!room.messages) {
        room.messages = [];
      }
      room.messages.push(chatMessage);
      if (room.messages.length > 100) {
        room.messages.splice(0, room.messages.length - 100);
      }

      broadcastToRoom(meta.roomId, {
        type: 'chat-message',
        message: chatMessage,
      });
      return;
    }

    if (msg.type === 'leave') {
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
}, 30000).unref();

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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server] Port ${PORT} is already in use (EADDRINUSE). Please ensure no other instance is running.`);
  } else {
    console.error('[Server] Fatal server error:', err);
  }
  process.exit(1);
});

const isTestEnvironment =
  process.env.NODE_ENV === 'test' ||
  process.argv.some(arg => typeof arg === 'string' && (arg.includes('test') || arg.includes('unit-tests')));

if (!isTestEnvironment) {
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎤 RVxis Server 2.0 (Pure WebRTC + WS)                  ║
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
}

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

export {
  app,
  server,
  wss,
  validateServerConfig,
  getIceServers,
  tokenRateLimiter,
  sanitizeNickname,
  validateClientMessage,
  createProtocolError,
  ROOM_ID_REGEX,
  PEER_ID_REGEX,
  rooms,
  clientMeta,
  getRoom,
  safeSend,
  broadcastToRoom,
  removeClientFromRoom,
};
