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
