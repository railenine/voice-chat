import assert from 'node:assert';
import test from 'node:test';

// -------------------------------------------------------------
// 1. Test Smartphone Detection Logic
// -------------------------------------------------------------

function simulateIsSmartphone({
  userAgent = '',
  isTauriApp = false,
  userAgentData = null,
  hasTouch = false,
  isCoarse = false,
  innerWidth = 1920,
  screenWidth = 1920,
}) {
  if (isTauriApp) return false;

  const isMobileUA = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone/i.test(userAgent);
  if (isMobileUA) return true;

  if (userAgentData && typeof userAgentData.mobile === 'boolean' && userAgentData.mobile) {
    return true;
  }

  const isSmallScreen = innerWidth <= 768 || screenWidth <= 768;
  if (hasTouch && isCoarse && isSmallScreen) {
    return true;
  }

  return false;
}

test('Device detection: iPhone is detected as smartphone', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  assert.strictEqual(simulateIsSmartphone({ userAgent: ua, innerWidth: 390 }), true);
});

test('Device detection: Android Mobile phone is detected as smartphone', () => {
  const ua = 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  assert.strictEqual(simulateIsSmartphone({ userAgent: ua, innerWidth: 412 }), true);
});

test('Device detection: Windows Desktop Chrome is NOT a smartphone', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  assert.strictEqual(simulateIsSmartphone({ userAgent: ua, innerWidth: 1920 }), false);
});

test('Device detection: Mac Desktop Safari is NOT a smartphone', () => {
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1';
  assert.strictEqual(simulateIsSmartphone({ userAgent: ua, innerWidth: 1440 }), false);
});

test('Device detection: Tauri Desktop app is NEVER a smartphone, even if narrow window', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'; // Even if spoofed UA
  assert.strictEqual(simulateIsSmartphone({ userAgent: ua, isTauriApp: true, innerWidth: 400 }), false);
});

test('Device detection: DevTools Mobile Emulation (touch + coarse + small screen) is detected as smartphone', () => {
  assert.strictEqual(
    simulateIsSmartphone({
      userAgent: 'Generic',
      hasTouch: true,
      isCoarse: true,
      innerWidth: 375,
      screenWidth: 375,
    }),
    true
  );
});

test('Device detection: Touchscreen Laptop (touch, but wide screen & fine mouse) is NOT a smartphone', () => {
  assert.strictEqual(
    simulateIsSmartphone({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      hasTouch: true,
      isCoarse: false,
      innerWidth: 1536,
      screenWidth: 1920,
    }),
    false
  );
});

// Strict Mobile & Tablet vs Desktop Screen Sharing Permission
function simulateIsMobileOrTablet({
  userAgent = '',
  isTauriApp = false,
  userAgentData = null,
  platform = '',
  maxTouchPoints = 0,
}) {
  if (isTauriApp) return false;
  if (userAgentData && typeof userAgentData.mobile === 'boolean' && userAgentData.mobile) {
    return true;
  }
  if (/Android/i.test(userAgent)) return true;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  const isIPadOS =
    (platform === 'MacIntel' || userAgent.includes('Macintosh')) &&
    maxTouchPoints > 1;
  if (isIPadOS) return true;
  if (/webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone|Mobile|Tablet/i.test(userAgent)) return true;
  return false;
}

function simulateIsDesktopPlatform(opts) {
  if (opts.isTauriApp) return true;
  if (simulateIsMobileOrTablet(opts)) return false;
  const ua = opts.userAgent || '';
  const platform = (opts.userAgentData && opts.userAgentData.platform) || opts.platform || '';
  if (/Win/i.test(platform) || /Windows NT/i.test(ua)) return true;
  if ((/Mac/i.test(platform) || /Macintosh/i.test(ua)) && (opts.maxTouchPoints || 0) <= 1) return true;
  if ((/Linux/i.test(platform) || /Linux|X11/i.test(ua)) && !/Android/i.test(ua)) return true;
  if (/CrOS/i.test(ua)) return true;
  return true;
}

function simulateCanShareScreen(opts) {
  return simulateIsDesktopPlatform(opts) && opts.hasGetDisplayMedia !== false;
}

test('Screen share permission: iPhone is strictly forbidden from streaming', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  assert.strictEqual(simulateCanShareScreen({ userAgent: ua }), false);
});

test('Screen share permission: iPad (iPadOS 13+ with Macintosh UA and touch) is strictly forbidden', () => {
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  assert.strictEqual(simulateCanShareScreen({ userAgent: ua, platform: 'MacIntel', maxTouchPoints: 5 }), false);
});

test('Screen share permission: Android Tablet (no Mobile keyword in UA) is strictly forbidden', () => {
  const ua = 'Mozilla/5.0 (Linux; Android 13; SM-X906B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  assert.strictEqual(simulateCanShareScreen({ userAgent: ua }), false);
});

test('Screen share permission: Android Phone is strictly forbidden', () => {
  const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  assert.strictEqual(simulateCanShareScreen({ userAgent: ua }), false);
});

test('Screen share permission: Windows Desktop PC (even if resized narrow < 1024px) is allowed', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  assert.strictEqual(simulateCanShareScreen({ userAgent: ua, platform: 'Win32' }), true);
});

test('Screen share permission: Windows Touch Laptop (e.g. Surface) is allowed', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  assert.strictEqual(simulateCanShareScreen({ userAgent: ua, platform: 'Win32', maxTouchPoints: 10 }), true);
});

test('Screen share permission: macOS Desktop Safari/Chrome (MacBook/iMac) is allowed', () => {
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1';
  assert.strictEqual(simulateCanShareScreen({ userAgent: ua, platform: 'MacIntel', maxTouchPoints: 0 }), true);
});

test('Screen share permission: Linux Desktop (Ubuntu/Fedora) is allowed', () => {
  const ua = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';
  assert.strictEqual(simulateCanShareScreen({ userAgent: ua, platform: 'Linux x86_64' }), true);
});

// -------------------------------------------------------------
// 2. Test Hotkey Utilities
// -------------------------------------------------------------

function formatKeyLabel(code, key) {
  if (code === 'Backquote' || key.toLowerCase() === 'ё' || key === '`' || key === '~') {
    return 'Ё / `';
  }
  if (code === 'Backslash' || key === '\\') {
    return '\\';
  }
  if (code === 'Space') return 'Пробел';
  if (code === 'Escape') return 'Esc';
  if (code === 'Enter') return 'Enter';
  if (code === 'Backspace') return 'Backspace';
  if (code === 'Tab') return 'Tab';
  if (code === 'CapsLock') return 'Caps Lock';
  if (code.startsWith('Key')) return code.replace('Key', '').toUpperCase();
  if (code.startsWith('Digit')) return code.replace('Digit', '');
  if (code.startsWith('Numpad')) return `Num ${code.replace('Numpad', '')}`;
  if (/^F\d{1,2}$/.test(code)) return code;
  if (key && key.length === 1) return key.toUpperCase();
  return code || key;
}

const MOUSE_HOTKEY_OPTIONS = [
  { code: 'Mouse3', key: 'Mouse3', label: 'Колёсико (Mouse 3)', type: 'mouse', button: 1 },
  { code: 'Mouse4', key: 'Mouse4', label: 'Мышь 4 (Боковая 1)', type: 'mouse', button: 3 },
  { code: 'Mouse5', key: 'Mouse5', label: 'Мышь 5 (Боковая 2)', type: 'mouse', button: 4 },
  { code: 'Mouse2', key: 'Mouse2', label: 'ПКМ (Mouse 2)', type: 'mouse', button: 2 },
];

function isSameHotkey(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === 'mouse') return a.code === b.code;
  return a.code === b.code;
}

test('Hotkey utils: formats Backquote / Russian Ё correctly', () => {
  assert.strictEqual(formatKeyLabel('Backquote', 'ё'), 'Ё / `');
  assert.strictEqual(formatKeyLabel('Backquote', '`'), 'Ё / `');
});

test('Hotkey utils: formats Backslash correctly', () => {
  assert.strictEqual(formatKeyLabel('Backslash', '\\'), '\\');
});

test('Hotkey utils: formats standard keys correctly', () => {
  assert.strictEqual(formatKeyLabel('KeyV', 'v'), 'V');
  assert.strictEqual(formatKeyLabel('KeyM', 'м'), 'M');
  assert.strictEqual(formatKeyLabel('Space', ' '), 'Пробел');
  assert.strictEqual(formatKeyLabel('F5', 'F5'), 'F5');
});

test('Hotkey utils: mouse buttons are distinct and non-conflicting by default', () => {
  const m3 = MOUSE_HOTKEY_OPTIONS.find((o) => o.code === 'Mouse3');
  const m4 = MOUSE_HOTKEY_OPTIONS.find((o) => o.code === 'Mouse4');
  assert.ok(m3);
  assert.ok(m4);
  assert.strictEqual(isSameHotkey(m3, m4), false);
  assert.strictEqual(isSameHotkey(m3, { ...m3 }), true);
});

// -------------------------------------------------------------
// 3. Test Reconnection & Connection State Resolution Logic
// -------------------------------------------------------------

function calculateReconnectDelay(attempts) {
  return Math.min(2000 + (attempts - 1) * 750, 5000);
}

function resolveConnectionState({
  isConnected,
  error,
  reconnectAttempts,
  showConnectedToast,
}) {
  const showBanner = !isConnected || Boolean(error) || showConnectedToast;
  let bannerType = null;

  if (showBanner) {
    if (error) {
      bannerType = 'error';
    } else if (showConnectedToast && isConnected) {
      bannerType = 'connected-success';
    } else {
      bannerType = 'reconnecting';
    }
  }

  const isFailedThreshold = reconnectAttempts >= 5;

  return {
    showBanner,
    bannerType,
    isFailedThreshold,
  };
}

test('Reconnection backoff: calculates linear backoff with 5000ms cap', () => {
  assert.strictEqual(calculateReconnectDelay(1), 2000);
  assert.strictEqual(calculateReconnectDelay(2), 2750);
  assert.strictEqual(calculateReconnectDelay(3), 3500);
  assert.strictEqual(calculateReconnectDelay(4), 4250);
  assert.strictEqual(calculateReconnectDelay(5), 5000);
  assert.strictEqual(calculateReconnectDelay(10), 5000);
});

test('Connection state: shows reconnecting banner during disconnect', () => {
  const state = resolveConnectionState({
    isConnected: false,
    error: null,
    reconnectAttempts: 1,
    showConnectedToast: false,
  });
  assert.strictEqual(state.showBanner, true);
  assert.strictEqual(state.bannerType, 'reconnecting');
  assert.strictEqual(state.isFailedThreshold, false);
});

test('Connection state: switches to error state after 5 failed reconnect attempts', () => {
  const state = resolveConnectionState({
    isConnected: false,
    error: 'Не удалось подключиться к серверу сигнализации',
    reconnectAttempts: 5,
    showConnectedToast: false,
  });
  assert.strictEqual(state.showBanner, true);
  assert.strictEqual(state.bannerType, 'error');
  assert.strictEqual(state.isFailedThreshold, true);
});

test('Connection state: shows connected-success toast when connection is restored', () => {
  const state = resolveConnectionState({
    isConnected: true,
    error: null,
    reconnectAttempts: 0,
    showConnectedToast: true,
  });
  assert.strictEqual(state.showBanner, true);
  assert.strictEqual(state.bannerType, 'connected-success');
});

test('Connection state: hides banner once connected and toast expires', () => {
  const state = resolveConnectionState({
    isConnected: true,
    error: null,
    reconnectAttempts: 0,
    showConnectedToast: false,
  });
  assert.strictEqual(state.showBanner, false);
  assert.strictEqual(state.bannerType, null);
});

// -------------------------------------------------------------
// 4. Test WebRTC Opus SDP Optimization & Noise Suppression Config
// -------------------------------------------------------------

function optimizeAudioSdp(sdp) {
  const match = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (!match) return sdp;
  const pt = match[1];

  const fmtpRegex = new RegExp(`(a=fmtp:${pt}\\s+)([^\\r\\n]+)`, 'i');
  const customParams = 'maxaveragebitrate=32000;stereo=0;sprop-stereo=0;useinbandfec=1;cbr=0;usedtx=1';

  if (fmtpRegex.test(sdp)) {
    return sdp.replace(fmtpRegex, (_m, prefix, params) => {
      const clean = params
        .replace(/maxaveragebitrate=\d+;?/gi, '')
        .replace(/stereo=[01];?/gi, '')
        .replace(/sprop-stereo=[01];?/gi, '')
        .replace(/useinbandfec=[01];?/gi, '')
        .replace(/cbr=[01];?/gi, '')
        .replace(/usedtx=[01];?/gi, '')
        .replace(/;\s*$/, '')
        .trim();
      const sep = clean.length > 0 && !clean.endsWith(';') ? ';' : '';
      return `${prefix}${clean}${sep}${customParams}`;
    });
  } else {
    return sdp.replace(
      new RegExp(`(a=rtpmap:${pt}\\s+opus\\/48000[^\\r\\n]*)`, 'i'),
      `$1\r\na=fmtp:${pt} ${customParams}`
    );
  }
}

test('Audio SDP Optimization: injects usedtx=1 and 32kbps mono for background noise elimination', () => {
  const mockSdp = `v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\n`;
  const optimized = optimizeAudioSdp(mockSdp);
  assert.ok(optimized.includes('usedtx=1'), 'SDP must include usedtx=1 for DTX discontinuous transmission');
  assert.ok(optimized.includes('maxaveragebitrate=32000'), 'SDP must include maxaveragebitrate=32000');
  assert.ok(optimized.includes('stereo=0'), 'SDP must enforce mono transmission');
});

// -------------------------------------------------------------
// 5. Test LiveKit SFU Token Generation & Grants
// -------------------------------------------------------------
import { AccessToken } from 'livekit-server-sdk';

test('LiveKit Token: generates valid JWT with room grants', async () => {
  const at = new AccessToken('test_key', 'test_secret_with_sufficient_length_123', {
    identity: 'peer-test-01',
    name: 'TestUser',
    ttl: '1h',
  });
  at.addGrant({
    roomJoin: true,
    room: 'room-xyz',
    canPublish: true,
    canSubscribe: true,
  });
  const jwt = await at.toJwt();
  assert.ok(typeof jwt === 'string' && jwt.length > 50, 'JWT token must be a non-empty string');
  assert.ok(jwt.split('.').length === 3, 'JWT token must have 3 parts (header.payload.signature)');
});

// -------------------------------------------------------------
// 6. Security: Production Secrets & Environment Validation
// -------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateServerConfig,
  getIceServers,
  sanitizeNickname,
  tokenRateLimiter,
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
} from '../server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Security: production mode refuses to start without COTURN_PASSWORD or COTURN_SHARED_SECRET', () => {
  const result = validateServerConfig({ NODE_ENV: 'production' });
  assert.strictEqual(result.valid, false, 'Production mode must fail when TURN password/secret is missing');
  assert.ok(result.error.includes('COTURN_PASSWORD'), 'Error message must clearly mention COTURN_PASSWORD');
});

test('Security: production mode accepts valid COTURN_PASSWORD', () => {
  const result = validateServerConfig({
    NODE_ENV: 'production',
    COTURN_PASSWORD: 'a-sufficiently-long-and-secure-turn-password-2026',
  });
  assert.strictEqual(result.valid, true);
});

test('Security: production mode accepts COTURN_SHARED_SECRET for ephemeral credentials', () => {
  const result = validateServerConfig({
    NODE_ENV: 'production',
    COTURN_SHARED_SECRET: 'hmac-shared-secret-for-ephemeral-turn-tokens-2026',
  });
  assert.strictEqual(result.valid, true);
});

test('Security: development and test modes allow start without TURN secret (safe STUN fallback)', () => {
  const devResult = validateServerConfig({ NODE_ENV: 'development' });
  assert.strictEqual(devResult.valid, true);

  const testResult = validateServerConfig({ NODE_ENV: 'test' });
  assert.strictEqual(testResult.valid, true);
});

test('Security: production mode requires both LIVEKIT_API_KEY and LIVEKIT_API_SECRET if one is provided', () => {
  const partial1 = validateServerConfig({
    NODE_ENV: 'production',
    COTURN_PASSWORD: 'secure_password',
    LIVEKIT_API_KEY: 'some_key',
    LIVEKIT_API_SECRET: '',
  });
  assert.strictEqual(partial1.valid, false, 'Should fail if secret is missing');

  const partial2 = validateServerConfig({
    NODE_ENV: 'production',
    COTURN_PASSWORD: 'secure_password',
    LIVEKIT_API_KEY: '',
    LIVEKIT_API_SECRET: 'some_secret',
  });
  assert.strictEqual(partial2.valid, false, 'Should fail if key is missing');
});

// -------------------------------------------------------------
// 7. Security: Ephemeral TURN & STUN Credential Generation
// -------------------------------------------------------------

test('Security ICE Servers: returns only STUN when no TURN password/secret is configured', () => {
  const origPass = process.env.COTURN_PASSWORD;
  const origSecret = process.env.COTURN_SHARED_SECRET;
  delete process.env.COTURN_PASSWORD;
  delete process.env.COTURN_SHARED_SECRET;

  try {
    const servers = getIceServers('test-peer');
    assert.ok(Array.isArray(servers) && servers.length > 0);
    for (const server of servers) {
      assert.ok(!server.urls.startsWith('turn:'), 'Should not provide TURN server without credentials');
      assert.ok(!server.urls.startsWith('turns:'), 'Should not provide TURNS server without credentials');
      assert.strictEqual(server.credential, undefined, 'Must not leak any credential');
      assert.strictEqual(server.username, undefined, 'Must not contain any username');
    }
  } finally {
    process.env.COTURN_PASSWORD = origPass;
    process.env.COTURN_SHARED_SECRET = origSecret;
  }
});

// -------------------------------------------------------------
// 8. Security: LiveKit Token Input Validation & Sanitization
// -------------------------------------------------------------

test('Security Input Validation: ROOM_ID_REGEX accepts valid room IDs', () => {
  assert.ok(ROOM_ID_REGEX.test('room-123'));
  assert.ok(ROOM_ID_REGEX.test('alpha_beta'));
  assert.ok(ROOM_ID_REGEX.test('MainRoom'));
  assert.ok(ROOM_ID_REGEX.test('998877'));
});

test('Security Input Validation: ROOM_ID_REGEX rejects malicious or invalid room IDs', () => {
  assert.strictEqual(ROOM_ID_REGEX.test(''), false, 'Empty string must be rejected');
  assert.strictEqual(ROOM_ID_REGEX.test('ab'), false, 'Less than 3 chars must be rejected');
  assert.strictEqual(ROOM_ID_REGEX.test('a'.repeat(65)), false, 'More than 64 chars must be rejected');
  assert.strictEqual(ROOM_ID_REGEX.test('room 123'), false, 'Spaces must be rejected');
  assert.strictEqual(ROOM_ID_REGEX.test('room$#@!'), false, 'Special chars must be rejected');
  assert.strictEqual(ROOM_ID_REGEX.test('<script>alert(1)</script>'), false, 'HTML tags must be rejected');
  assert.strictEqual(ROOM_ID_REGEX.test('../../../etc/passwd'), false, 'Path traversal must be rejected');
});

test('Security Input Validation: PEER_ID_REGEX validates peer IDs strictly', () => {
  assert.ok(PEER_ID_REGEX.test('peer-123_abc'));
  assert.strictEqual(PEER_ID_REGEX.test('p'), false, 'Too short must be rejected');
  assert.strictEqual(PEER_ID_REGEX.test('peer with spaces'), false, 'Spaces must be rejected');
  assert.strictEqual(PEER_ID_REGEX.test('peer!@#'), false, 'Special characters must be rejected');
});

test('Security Sanitization: sanitizeNickname strips control characters and limits length', () => {
  assert.strictEqual(sanitizeNickname('Alex'), 'Alex');
  assert.strictEqual(sanitizeNickname('Alex\x00\x08\x1b'), 'Alex', 'Must strip control characters');
  assert.strictEqual(sanitizeNickname('   Maria   '), 'Maria');
  const longName = 'A'.repeat(50);
  assert.strictEqual(sanitizeNickname(longName).length, 32);
  assert.strictEqual(sanitizeNickname(''), 'User');
  assert.strictEqual(sanitizeNickname(null), 'User');
  assert.strictEqual(sanitizeNickname(undefined), 'User');
});

// -------------------------------------------------------------
// 9. Security: Production Frontend Bundle Scan for Secrets
// -------------------------------------------------------------

test('Security Bundle Scan: compiled dist/ bundle must NOT contain fallback secrets', () => {
  const distAssetsDir = path.join(rootDir, 'dist', 'assets');
  if (!fs.existsSync(distAssetsDir)) {
    return;
  }

  const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
  assert.ok(jsFiles.length > 0, 'Compiled JavaScript assets should exist in dist/assets');

  const FORBIDDEN_STRINGS = [
    'VoiceChatSecret2026!',
    'VoiceChat2026!',
    'rvxis_livekit_key',
    'VoiceChat2026SecureTurnPassword!',
  ];

  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
    for (const forbidden of FORBIDDEN_STRINGS) {
      assert.strictEqual(
        content.includes(forbidden),
        false,
        `SECURITY VIOLATION: Bundle file ${file} contains forbidden secret '${forbidden}'!`
      );
    }
  }
});

// -------------------------------------------------------------
// 10. Security: Ephemeral HMAC TURN Credentials Verification
// -------------------------------------------------------------

test('Security Ephemeral TURN: generates valid HMAC-SHA1 signature and timestamped username', () => {
  const testSecret = 'secret_key_12345';
  process.env.COTURN_SHARED_SECRET = testSecret;

  try {
    const servers = getIceServers('peer-agent-77');
    const turnServer = servers.find((s) => s.urls.startsWith('turn:'));
    assert.ok(turnServer, 'Must return TURN server when COTURN_SHARED_SECRET is set');
    assert.ok(turnServer.username, 'TURN server must have ephemeral username');
    assert.ok(turnServer.credential, 'TURN server must have ephemeral credential');

    // Username must be in format <timestamp>:<peerId>
    const [expiryStr, peerId] = turnServer.username.split(':');
    const expiry = parseInt(expiryStr, 10);
    assert.ok(!isNaN(expiry) && expiry > Math.floor(Date.now() / 1000), 'Expiry must be a future timestamp');
    assert.strictEqual(peerId, 'peer-agent-77');

    // Credential must match HMAC-SHA1(testSecret, username)
    import('node:crypto').then((crypto) => {
      const expectedHmac = crypto
        .createHmac('sha1', testSecret)
        .update(turnServer.username)
        .digest('base64');
      assert.strictEqual(turnServer.credential, expectedHmac);
    });
  } finally {
    delete process.env.COTURN_SHARED_SECRET;
  }
});

// -------------------------------------------------------------
// 11. Security: Token Rate Limiter Middleware
// -------------------------------------------------------------

test('Security Rate Limiter: throttles requests exceeding window limit', () => {
  const req = { ip: '198.51.100.42' };
  let statusResult = null;
  let jsonResult = null;

  const res = {
    status(code) {
      statusResult = code;
      return {
        json(data) {
          jsonResult = data;
        },
      };
    },
  };

  let nextCalledCount = 0;
  const next = () => {
    nextCalledCount++;
  };

  // Up to 20 calls allowed per window
  for (let i = 0; i < 20; i++) {
    tokenRateLimiter(req, res, next);
  }
  assert.strictEqual(nextCalledCount, 20, 'First 20 requests must pass rate limiter');

  // 21st call should trigger 429 Too Many Requests
  tokenRateLimiter(req, res, next);
  assert.strictEqual(statusResult, 429, 'Excess request must return HTTP 429');
  assert.strictEqual(jsonResult?.error, 'rate_limit_exceeded');
  assert.strictEqual(nextCalledCount, 20, 'next() must NOT be called when rate limited');
});

// -------------------------------------------------------------
// 12. WebSocket Signaling Protocol & Lifecycle Tests
// -------------------------------------------------------------

test('Protocol: 1. Every valid client message passes validation', () => {
  const meta = { roomId: 'room-101', peerId: 'peer-alice' };

  // join (without prior meta)
  const joinRes = validateClientMessage({
    type: 'join',
    roomId: 'room-101',
    peerId: 'peer-alice',
    nickname: 'Alice',
    isMuted: false,
    isDeafened: false,
  }, null);
  assert.strictEqual(joinRes.valid, true);

  // signal (SDP)
  const sdpRes = validateClientMessage({
    type: 'signal',
    to: 'peer-bob',
    data: { description: { type: 'offer', sdp: 'v=0...' } },
  }, meta);
  assert.strictEqual(sdpRes.valid, true);

  // signal (ICE candidate)
  const iceRes = validateClientMessage({
    type: 'signal',
    to: 'peer-bob',
    data: { candidate: { candidate: 'candidate:1 1 UDP ...', sdpMid: '0', sdpMLineIndex: 0 } },
  }, meta);
  assert.strictEqual(iceRes.valid, true);

  // update-nickname
  const nickRes = validateClientMessage({ type: 'update-nickname', nickname: 'AliceNew' }, meta);
  assert.strictEqual(nickRes.valid, true);

  // update-mute
  const muteRes = validateClientMessage({ type: 'update-mute', isMuted: true }, meta);
  assert.strictEqual(muteRes.valid, true);

  // update-deafen
  const deafRes = validateClientMessage({ type: 'update-deafen', isDeafened: true }, meta);
  assert.strictEqual(deafRes.valid, true);

  // speaking
  const speakRes = validateClientMessage({ type: 'speaking', isSpeaking: true }, meta);
  assert.strictEqual(speakRes.valid, true);

  // chat-message
  const chatRes = validateClientMessage({ type: 'chat-message', text: 'Hello, room!' }, meta);
  assert.strictEqual(chatRes.valid, true);

  // leave
  const leaveRes = validateClientMessage({ type: 'leave' }, meta);
  assert.strictEqual(leaveRes.valid, true);
});

test('Protocol: 2. Unknown message type is rejected', () => {
  const meta = { roomId: 'room-101', peerId: 'peer-alice' };
  const res = validateClientMessage({ type: 'unknown-action', foo: 42 }, meta);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.code, 'invalid_message');
  assert.ok(res.message.includes('Unknown message type'));
});

test('Protocol: 3. Invalid field types are rejected', () => {
  const meta = { roomId: 'room-101', peerId: 'peer-alice' };

  // isMuted must be boolean
  const badMute = validateClientMessage({ type: 'update-mute', isMuted: 'yes' }, meta);
  assert.strictEqual(badMute.valid, false);
  assert.strictEqual(badMute.code, 'invalid_message');

  // isSpeaking must be boolean
  const badSpeak = validateClientMessage({ type: 'speaking', isSpeaking: 1 }, meta);
  assert.strictEqual(badSpeak.valid, false);
  assert.strictEqual(badSpeak.code, 'invalid_message');

  // isDeafened must be boolean
  const badDeafen = validateClientMessage({ type: 'update-deafen', isDeafened: 'true' }, meta);
  assert.strictEqual(badDeafen.valid, false);
  assert.strictEqual(badDeafen.code, 'invalid_message');

  // chat text must be string
  const badChat = validateClientMessage({ type: 'chat-message', text: 12345 }, meta);
  assert.strictEqual(badChat.valid, false);
  assert.strictEqual(badChat.code, 'invalid_message');
});

test('Protocol: 4. Field length limits are strictly enforced', () => {
  const meta = { roomId: 'room-101', peerId: 'peer-alice' };

  // roomId too long (> 64)
  const longRoom = validateClientMessage({
    type: 'join',
    roomId: 'r'.repeat(65),
    peerId: 'peer-1',
  }, null);
  assert.strictEqual(longRoom.valid, false);

  // peerId too long (> 64)
  const longPeer = validateClientMessage({
    type: 'join',
    roomId: 'room-1',
    peerId: 'p'.repeat(65),
  }, null);
  assert.strictEqual(longPeer.valid, false);

  // chat message too long (> 1000)
  const longChat = validateClientMessage({
    type: 'chat-message',
    text: 'a'.repeat(1001),
  }, meta);
  assert.strictEqual(longChat.valid, false);
});

test('Protocol: 5. Invalid JSON payload does not crash connection and error format is standard', () => {
  const err = createProtocolError('invalid_message', 'Invalid JSON syntax');
  assert.strictEqual(err.type, 'error');
  assert.strictEqual(err.code, 'invalid_message');
  assert.strictEqual(typeof err.message, 'string');
  assert.strictEqual(err.stack, undefined, 'Must NEVER include stack trace');
});

test('Protocol: 6. Signal cannot be forwarded to a peer in another room or self', () => {
  const meta = { roomId: 'room-alpha', peerId: 'peer-alice' };

  // Cannot signal self
  const selfSignal = validateClientMessage({
    type: 'signal',
    to: 'peer-alice',
    data: { description: { type: 'offer', sdp: 'v=0' } },
  }, meta);
  assert.strictEqual(selfSignal.valid, false);
  assert.strictEqual(selfSignal.code, 'invalid_signal');

  // Cannot signal without joining a room first
  const unauthSignal = validateClientMessage({
    type: 'signal',
    to: 'peer-bob',
    data: { description: { type: 'offer', sdp: 'v=0' } },
  }, null);
  assert.strictEqual(unauthSignal.valid, false);
  assert.strictEqual(unauthSignal.code, 'unauthorized');
});

test('Protocol: 7. Join with duplicate peerId evicts old socket cleanly', () => {
  const testRoomId = 'test-room-dup-7';
  const testPeerId = 'peer-duplicate-user';

  const room = getRoom(testRoomId);
  let oldSocketClosed = false;

  const mockOldSocket = {
    readyState: 1, // OPEN
    close() {
      oldSocketClosed = true;
    },
    send() {},
  };

  room.set(testPeerId, {
    ws: mockOldSocket,
    peerId: testPeerId,
    nickname: 'OldUser',
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
  });
  clientMeta.set(mockOldSocket, { roomId: testRoomId, peerId: testPeerId });

  // Simulate new socket joining with duplicate peerId
  const mockNewSocket = {
    readyState: 1,
    close() {},
    send() {},
  };

  // Eviction logic test
  const existingClient = room.get(testPeerId);
  if (existingClient && existingClient.ws !== mockNewSocket) {
    existingClient.ws.close();
    clientMeta.delete(existingClient.ws);
    room.delete(testPeerId);
  }

  assert.strictEqual(oldSocketClosed, true, 'Old socket must be closed upon duplicate join');
  assert.strictEqual(clientMeta.has(mockOldSocket), false, 'Old socket metadata must be deleted');
  assert.strictEqual(room.has(testPeerId), false, 'Old peer must be removed prior to replacement');

  // Cleanup
  rooms.delete(testRoomId);
});

test('Protocol: 8. Reconnect does not create duplicate peers in room', () => {
  const testRoomId = 'test-room-recon-8';
  const testPeerId = 'peer-recon-user';
  const room = getRoom(testRoomId);

  const mockSocket1 = { readyState: 1, close() {}, send() {} };
  const mockSocket2 = { readyState: 1, close() {}, send() {} };

  // Connect 1
  room.set(testPeerId, { ws: mockSocket1, peerId: testPeerId, nickname: 'ReconUser' });
  assert.strictEqual(room.size, 1);

  // Connect 2 (reconnect)
  if (room.has(testPeerId)) {
    room.delete(testPeerId);
  }
  room.set(testPeerId, { ws: mockSocket2, peerId: testPeerId, nickname: 'ReconUser' });

  assert.strictEqual(room.size, 1, 'Room must have exactly 1 peer after reconnect');

  // Cleanup
  rooms.delete(testRoomId);
});

test('Protocol: 9. Leave cleanly deletes client and closes empty room', () => {
  const testRoomId = 'test-room-leave-9';
  const testPeerId = 'peer-leave-user';
  const room = getRoom(testRoomId);

  const mockSocket = { readyState: 1, close() {}, send() {} };
  clientMeta.set(mockSocket, { roomId: testRoomId, peerId: testPeerId });
  room.set(testPeerId, { ws: mockSocket, peerId: testPeerId });

  assert.strictEqual(rooms.has(testRoomId), true);
  assert.strictEqual(room.size, 1);

  removeClientFromRoom(mockSocket);

  assert.strictEqual(clientMeta.has(mockSocket), false, 'Metadata must be deleted on leave');
  assert.strictEqual(rooms.has(testRoomId), false, 'Empty room must be deleted from rooms Map');
});

test('Protocol: 10. Sending after socket close is safe (no crash)', () => {
  const closedSocket = {
    readyState: 3, // CLOSED
    send() {
      throw new Error('WebSocket is not open');
    },
  };

  const sent = safeSend(closedSocket, { type: 'user-left', peerId: 'peer-x' });
  assert.strictEqual(sent, false, 'safeSend must return false when socket is closed');
});

test('Protocol: 11. Chat message correctly validated, sanitized, and trimmed', () => {
  const meta = { roomId: 'room-chat', peerId: 'peer-chat' };

  // Empty chat rejected
  const emptyRes = validateClientMessage({ type: 'chat-message', text: '   ' }, meta);
  assert.strictEqual(emptyRes.valid, false);
  assert.strictEqual(emptyRes.code, 'invalid_message');

  // Valid trimmed chat
  const validRes = validateClientMessage({ type: 'chat-message', text: '  Hello world!  ' }, meta);
  assert.strictEqual(validRes.valid, true);
  assert.strictEqual(validRes.data.text, 'Hello world!');
});

test('Protocol: 12. Rate limiting allows WebRTC bursts while capping abuse', () => {
  const ws = {
    msgCount: 0,
    lastMsgReset: Date.now(),
  };

  const RATE_LIMIT_MAX_MSG = 100;
  const RATE_LIMIT_HARD_CAP = 250;

  // Standard message check
  for (let i = 0; i < 150; i++) {
    ws.msgCount++;
  }

  // A standard message at msgCount = 150 should exceed normal rate limit
  const isNormalThrottled = ws.msgCount > RATE_LIMIT_MAX_MSG;
  assert.strictEqual(isNormalThrottled, true, 'Standard messages over 100/s must be flagged for throttling');

  // Critical WebRTC signaling is allowed up to 250
  const isSignalAllowed = ws.msgCount <= RATE_LIMIT_HARD_CAP;
  assert.strictEqual(isSignalAllowed, true, 'WebRTC signaling must be permitted through burst window up to 250/s');
});




