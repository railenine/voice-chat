import crypto from 'node:crypto';

// Disconnected identities are reserved briefly; only live membership authorizes HTTP.
const reservations = new Map();
const reconnectWindowMs = 60_000;
const keyFor = (roomId, peerId) => JSON.stringify([roomId, peerId]);
const sameSecret = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) &&
  crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function claimSession(roomId, peerId, token, ws) {
  const key = keyFor(roomId, peerId);
  const existing = reservations.get(key);
  if (existing && (existing.ws || existing.expiresAt > Date.now()) && !sameSecret(existing.token, token)) {
    return null;
  }
  const session = { roomId, peerId, token: existing && sameSecret(existing.token, token)
    ? existing.token : crypto.randomBytes(32).toString('hex'), ws, expiresAt: Infinity };
  reservations.set(key, session);
  return session;
}

export function releaseSession(roomId, peerId, ws, intentional = false) {
  const key = keyFor(roomId, peerId);
  const session = reservations.get(key);
  if (!session || session.ws !== ws) return;
  if (intentional) reservations.delete(key);
  else { session.ws = null; session.expiresAt = Date.now() + reconnectWindowMs; }
}

export function authorizeSession(req, roomId, peerId) {
  const session = reservations.get(keyFor(roomId, peerId));
  const header = req.headers.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  return session?.ws?.readyState === 1 && sameSecret(session.token, token) ? session : null;
}

setInterval(() => {
  for (const [key, session] of reservations) {
    if (!session.ws && session.expiresAt <= Date.now()) reservations.delete(key);
  }
}, reconnectWindowMs).unref();

export function isAllowedOrigin(origin, env = process.env) {
  // Native clients have no Origin. They still need a session for protected APIs.
  if (!origin) return true;
  const nativeOrigins = ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'];
  if (nativeOrigins.includes(origin)) return true;
  const configured = env.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean);
  if (configured?.length && !configured.includes('*')) return configured.includes(origin);
  if (origin === 'https://rvxis.site') return true;
  if (env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch { return false; }
  }
  return false;
}
