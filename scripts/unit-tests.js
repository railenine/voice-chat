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


