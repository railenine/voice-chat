import assert from 'node:assert';
import test, { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

// 1. Real production imports
import { parseSemver, compareSemver, isNewerVersion } from '../../src/utils/semver.ts';
import {
  detectIsSmartphone,
  detectIsDesktopPlatform,
  detectCanShareScreen,
  detectIsMobileOrTablet,
} from '../../src/utils/devicePolicy.ts';
import {
  formatKeyLabel,
  DEFAULT_HOTKEY,
  DEFAULT_DEAFEN_HOTKEY,
  MOUSE_HOTKEY_OPTIONS,
  mouseButtonToConfig,
  mouseCodeToConfig,
  isHotkeyMatch,
} from '../../src/hooks/useHotkey.ts';
import { optimizeAudioSdp } from '../../src/utils/sdp.ts';
import {
  calculateReconnectDelay,
  resolveConnectionBannerState,
} from '../../src/utils/connectionPolicy.ts';
import {
  clampVolume,
  getSavedPeerVolume,
  savePeerVolume,
} from '../../src/utils/volumePolicy.ts';
import {
  getRoomCapacityStatus,
  MAX_ROOM_CAPACITY,
} from '../../src/utils/capacityPolicy.ts';
import {
  shouldAutoOpenUpdateModal,
  verifyDownloadIntegrity,
  verifyChecksum,
  checkNetworkState,
  buildUpdaterUrl,
} from '../../src/utils/updaterPolicy.ts';
import {
  ROOM_ID_REGEX,
  PEER_ID_REGEX,
  sanitizeNickname,
  createProtocolError,
  validateClientMessage,
} from '../../server/protocol.js';
import { validateManifestSchema } from '../../scripts/generate-latest-json.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('1. Pure Logic & SemVer Unit Tests', () => {
  it('parses valid semver versions correctly', () => {
    assert.deepStrictEqual(parseSemver('1.2.3'), {
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: [],
      raw: '1.2.3',
    });
    assert.deepStrictEqual(parseSemver('v0.1.12-beta.2'), {
      major: 0,
      minor: 1,
      patch: 12,
      prerelease: ['beta', 2],
      raw: 'v0.1.12-beta.2',
    });
  });

  it('rejects invalid semver formats safely', () => {
    assert.strictEqual(parseSemver('invalid'), null);
    assert.strictEqual(parseSemver('1.0'), null);
    assert.strictEqual(parseSemver(''), null);
    assert.strictEqual(parseSemver(null), null);
  });

  it('compares semver numbers: 0.1.9 vs 0.1.10 (0.1.10 is newer)', () => {
    assert.strictEqual(isNewerVersion('0.1.10', '0.1.9'), true);
    assert.strictEqual(isNewerVersion('0.1.9', '0.1.10'), false);
    assert.strictEqual(isNewerVersion('0.1.10', '0.1.10'), false);
  });

  it('handles v-prefix normalization correctly', () => {
    assert.strictEqual(isNewerVersion('v0.1.10', '0.1.10'), false);
    assert.strictEqual(isNewerVersion('0.1.10', 'v0.1.10'), false);
    assert.strictEqual(isNewerVersion('v0.1.11', 'v0.1.10'), true);
  });

  it('handles prerelease version precedence', () => {
    assert.strictEqual(isNewerVersion('0.1.10', '0.1.10-beta.1'), true);
    assert.strictEqual(isNewerVersion('0.1.10-beta.1', '0.1.10'), false);
    assert.strictEqual(isNewerVersion('0.1.10-beta.2', '0.1.10-beta.1'), true);
  });
});

describe('2. Real Device & Screen Share Policy Unit Tests', () => {
  it('detects iPhone as smartphone and forbids screen sharing', () => {
    const env = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      innerWidth: 390,
      hasTouch: true,
      isCoarse: true,
    };
    assert.strictEqual(detectIsSmartphone(env), true);
    assert.strictEqual(detectCanShareScreen(env), false);
  });

  it('detects Android phone as smartphone and forbids screen sharing', () => {
    const env = {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 Mobile Safari/537.36',
      innerWidth: 412,
      hasTouch: true,
      isCoarse: true,
    };
    assert.strictEqual(detectIsSmartphone(env), true);
    assert.strictEqual(detectCanShareScreen(env), false);
  });

  it('detects iPadOS 13+ with Macintosh UA and forbids screen sharing', () => {
    const env = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
      hasTouch: true,
    };
    assert.strictEqual(detectIsMobileOrTablet(env), true);
    assert.strictEqual(detectCanShareScreen(env), false);
  });

  it('detects Windows Desktop PC as desktop and allows screen sharing', () => {
    const env = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      platform: 'Win32',
      maxTouchPoints: 0,
      hasGetDisplayMedia: true,
    };
    assert.strictEqual(detectIsDesktopPlatform(env), true);
    assert.strictEqual(detectIsSmartphone(env), false);
    assert.strictEqual(detectCanShareScreen(env), true);
  });

  it('detects Windows Touch Laptop (e.g. Surface) as desktop and allows screen sharing', () => {
    const env = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      platform: 'Win32',
      maxTouchPoints: 10,
      hasTouch: true,
      hasGetDisplayMedia: true,
    };
    assert.strictEqual(detectIsDesktopPlatform(env), true);
    assert.strictEqual(detectCanShareScreen(env), true);
  });

  it('Tauri desktop app is always desktop even if userAgent is spoofed', () => {
    const env = {
      isTauriApp: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      innerWidth: 400,
    };
    assert.strictEqual(detectIsSmartphone(env), false);
    assert.strictEqual(detectIsDesktopPlatform(env), true);
  });
});

describe('3. Real Hotkey Policy Unit Tests', () => {
  it('formats Russian Ё and Backquote correctly', () => {
    assert.strictEqual(formatKeyLabel('Backquote', 'ё'), 'Ё / `');
    assert.strictEqual(formatKeyLabel('Backquote', '`'), 'Ё / `');
    assert.strictEqual(formatKeyLabel('Backquote', '~'), 'Ё / `');
  });

  it('formats Backslash and special keys', () => {
    assert.strictEqual(formatKeyLabel('Backslash', '\\'), '\\');
    assert.strictEqual(formatKeyLabel('Space', ' '), 'Пробел');
    assert.strictEqual(formatKeyLabel('Escape', 'Escape'), 'Esc');
    assert.strictEqual(formatKeyLabel('Enter', 'Enter'), 'Enter');
  });

  it('resolves mouse hotkey options distinctly', () => {
    const m3 = mouseButtonToConfig(1);
    const m4 = mouseButtonToConfig(3);
    const m5 = mouseButtonToConfig(4);
    assert.strictEqual(m3?.code, 'Mouse3');
    assert.strictEqual(m4?.code, 'Mouse4');
    assert.strictEqual(m5?.code, 'Mouse5');
    assert.strictEqual(mouseButtonToConfig(99), null);
  });

  it('matches keyboard hotkey events accurately', () => {
    const hotkey = DEFAULT_HOTKEY; // Backquote / 'ё'
    assert.strictEqual(isHotkeyMatch({ code: 'Backquote', key: '`' }, hotkey), true);
    assert.strictEqual(isHotkeyMatch({ code: 'Backquote', key: 'ё' }, hotkey), true);
    assert.strictEqual(isHotkeyMatch({ code: 'KeyV', key: 'v' }, hotkey), false);
  });
});

describe('4. Real WebRTC SDP Optimization Unit Tests', () => {
  it('injects maxaveragebitrate=32000, mono, and usedtx=1 into Opus SDP', () => {
    const mockSdp = `v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\n`;
    const optimized = optimizeAudioSdp(mockSdp);
    assert.ok(optimized.includes('usedtx=1'), 'SDP must include usedtx=1');
    assert.ok(optimized.includes('maxaveragebitrate=32000'), 'SDP must limit bitrate to 32kbps');
    assert.ok(optimized.includes('stereo=0'), 'SDP must enforce mono');
  });

  it('adds fmtp line when none exists', () => {
    const bareSdp = `v=0\r\na=rtpmap:111 opus/48000/2\r\n`;
    const optimized = optimizeAudioSdp(bareSdp);
    assert.ok(optimized.includes('a=fmtp:111'), 'Must add fmtp line');
    assert.ok(optimized.includes('usedtx=1'));
  });
});

describe('5. Real Connection Policy & Backoff Unit Tests', () => {
  it('calculates linear backoff with 5000ms cap', () => {
    assert.strictEqual(calculateReconnectDelay(1), 2000);
    assert.strictEqual(calculateReconnectDelay(2), 2750);
    assert.strictEqual(calculateReconnectDelay(3), 3500);
    assert.strictEqual(calculateReconnectDelay(4), 4250);
    assert.strictEqual(calculateReconnectDelay(5), 5000);
    assert.strictEqual(calculateReconnectDelay(10), 5000);
  });

  it('resolves reconnecting and connected states', () => {
    const reconnecting = resolveConnectionBannerState({
      isConnected: false,
      error: null,
      reconnectAttempts: 2,
      showConnectedToast: false,
    });
    assert.strictEqual(reconnecting.showBanner, true);
    assert.strictEqual(reconnecting.bannerType, 'reconnecting');
    assert.strictEqual(reconnecting.isFailedThreshold, false);

    const connected = resolveConnectionBannerState({
      isConnected: true,
      error: null,
      reconnectAttempts: 0,
      showConnectedToast: true,
    });
    assert.strictEqual(connected.showBanner, true);
    assert.strictEqual(connected.bannerType, 'connected-success');

    const hidden = resolveConnectionBannerState({
      isConnected: true,
      error: null,
      reconnectAttempts: 0,
      showConnectedToast: false,
    });
    assert.strictEqual(hidden.showBanner, false);
  });

  it('detects room full in banner resolution', () => {
    const full = resolveConnectionBannerState({
      isConnected: false,
      error: 'Комната заполнена (room_full)',
      reconnectAttempts: 1,
      showConnectedToast: false,
    });
    assert.strictEqual(full.showBanner, true);
    assert.strictEqual(full.bannerType, 'error');
    assert.strictEqual(full.isRoomFull, true);
  });
});

describe('6. Real Volume Policy & Persistence Unit Tests', () => {
  it('clamps volume to [0, 200] and rounds integers', () => {
    assert.strictEqual(clampVolume(-10), 0);
    assert.strictEqual(clampVolume(250), 200);
    assert.strictEqual(clampVolume(124.6), 125);
    assert.strictEqual(clampVolume(100), 100);
  });

  it('saves and restores volume isolated by peerId and nickname', () => {
    const store = new Map();
    const mockStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
    };

    savePeerVolume(mockStorage, 'peer-1', 150, 'Alice');
    assert.strictEqual(getSavedPeerVolume(mockStorage, 'peer-1'), 150);
    assert.strictEqual(getSavedPeerVolume(mockStorage, '', 'Alice'), 150);
    assert.strictEqual(getSavedPeerVolume(mockStorage, 'unknown-peer'), 100);
  });
});

describe('7. Real Capacity Policy Unit Tests', () => {
  it('computes mesh status across 1, 4, 8, 12, 13 participants', () => {
    assert.deepStrictEqual(getRoomCapacityStatus(1), { count: 1, max: 12, isFull: false, isMeshHeavy: false });
    assert.deepStrictEqual(getRoomCapacityStatus(4), { count: 4, max: 12, isFull: false, isMeshHeavy: false });
    assert.deepStrictEqual(getRoomCapacityStatus(8), { count: 8, max: 12, isFull: false, isMeshHeavy: true });
    assert.deepStrictEqual(getRoomCapacityStatus(12), { count: 12, max: 12, isFull: true, isMeshHeavy: false });
    assert.deepStrictEqual(getRoomCapacityStatus(13), { count: 13, max: 12, isFull: true, isMeshHeavy: false });
  });
});

describe('8. Real Updater Policy Unit Tests', () => {
  it('suppresses auto-open modal during call or when previously dismissed', () => {
    // In room -> suppressed
    assert.strictEqual(
      shouldAutoOpenUpdateModal({ availableVersion: '0.1.13', isManual: false, isInRoom: true }),
      false
    );
    // Dismissed exact version -> suppressed
    assert.strictEqual(
      shouldAutoOpenUpdateModal({ availableVersion: '0.1.13', isManual: false, isInRoom: false, dismissedVersion: '0.1.13' }),
      false
    );
    // Manual check -> ALWAYS opens
    assert.strictEqual(
      shouldAutoOpenUpdateModal({ availableVersion: '0.1.13', isManual: true, isInRoom: true }),
      true
    );
    // New subsequent version -> opens
    assert.strictEqual(
      shouldAutoOpenUpdateModal({ availableVersion: '0.1.14', isManual: false, isInRoom: false, dismissedVersion: '0.1.13' }),
      true
    );
  });

  it('verifies download integrity against total bytes', () => {
    assert.strictEqual(verifyDownloadIntegrity(100, 100).success, true);
    assert.strictEqual(verifyDownloadIntegrity(90, 100).success, false);
  });

  it('verifies sha256 checksum case-insensitively', async () => {
    const data = Buffer.from('RVxis binary test content');
    const expectedHash = crypto.createHash('sha256').update(data).digest('hex');
    assert.strictEqual(await verifyChecksum(data, expectedHash.toUpperCase()), true);
    assert.strictEqual(await verifyChecksum(data, '0000000000000000000000000000000000000000000000000000000000000000'), false);
  });

  it('builds cache-busting updater URL', () => {
    const url = buildUpdaterUrl('https://example.com', 1700000000);
    assert.strictEqual(url, 'https://example.com/peerjs/updater/latest.json?_t=1700000000');
  });
});

describe('9. Real Protocol & Manifest Schema Validation Unit Tests', () => {
  it('sanitizes nicknames and removes control characters', () => {
    assert.strictEqual(sanitizeNickname('Alex\x00\x1f'), 'Alex');
    assert.strictEqual(sanitizeNickname('   Maria   '), 'Maria');
    assert.strictEqual(sanitizeNickname(''), 'User');
    assert.strictEqual(sanitizeNickname('A'.repeat(50)).length, 32);
  });

  it('strictly validates roomId and peerId format', () => {
    assert.ok(ROOM_ID_REGEX.test('room-123'));
    assert.ok(ROOM_ID_REGEX.test('Main_Room'));
    assert.strictEqual(ROOM_ID_REGEX.test('r!'), false);
    assert.strictEqual(ROOM_ID_REGEX.test('../etc/passwd'), false);
    assert.strictEqual(ROOM_ID_REGEX.test(''), false);
  });

  it('validates client protocol messages', () => {
    const meta = { roomId: 'room-1', peerId: 'peer-1' };
    const validJoin = validateClientMessage({
      type: 'join',
      roomId: 'room-1',
      peerId: 'peer-1',
      nickname: 'Bob',
    }, null);
    assert.strictEqual(validJoin.valid, true);

    const badType = validateClientMessage({ type: 'unknown_type' }, meta);
    assert.strictEqual(badType.valid, false);

    const badMute = validateClientMessage({ type: 'update-mute', isMuted: 'not-bool' }, meta);
    assert.strictEqual(badMute.valid, false);
  });

  it('validates release manifest schema against strict requirements', () => {
    const validManifest = {
      version: '0.1.12',
      pub_date: '2026-10-03T19:00:00.000Z',
      platforms: {
        'windows-x86_64': {
          signature: 'sig...',
          url: 'https://github.com/railenine/voice-chat/releases/download/v0.1.12/RVxis_0.1.12_x64-setup.exe',
          size: 15000000,
          sha256: 'a'.repeat(64),
        },
      },
      portable: {
        'windows-x86_64': {
          url: 'https://github.com/railenine/voice-chat/releases/download/v0.1.12/RVxis.exe',
          size: 17000000,
          sha256: 'b'.repeat(64),
        },
      },
      portable_url: 'https://github.com/railenine/voice-chat/releases/download/v0.1.12/RVxis.exe',
    };
    assert.strictEqual(validateManifestSchema(validManifest), true);
  });
});
