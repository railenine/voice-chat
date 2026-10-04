import assert from 'node:assert';
import test, { describe, it } from 'node:test';

// 1. Lobby room code generation policy
function generateLobbyRoomId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excludes 0, O, 1, I
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function sanitizeLobbyRoomInput(rawInput) {
  if (typeof rawInput !== 'string') return '';
  return rawInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 64);
}

// 2. Update Modal state machine & in-room protection policy
function resolveUpdateModalUI(state, isInRoom) {
  const isLockedProgress = state === 'downloading' || state === 'installing';
  const showWarning = isInRoom && (state === 'available' || state === 'downloaded');
  const warningText = showWarning
    ? 'Внимание: Вы находитесь в голосовом канале. Установка обновления разорвет активное соединение и перезапустит приложение.'
    : null;

  return {
    isLockedProgress,
    showWarning,
    warningText,
  };
}

// 3. Audio device selection fallback policy
function resolveAudioDeviceFallback(selectedDeviceId, availableDeviceList) {
  if (!selectedDeviceId || selectedDeviceId === 'default') {
    return 'default';
  }
  const exists = availableDeviceList.some((d) => d.deviceId === selectedDeviceId);
  return exists ? selectedDeviceId : 'default';
}

// 4. Microphone permission denied handler policy
function handleMicrophoneError(error) {
  const errName = error?.name || '';
  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    return {
      status: 'permission_denied',
      userGuidance: 'Доступ к микрофону заблокирован. Разрешите доступ в настройках браузера или ОС.',
    };
  }
  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return {
      status: 'device_not_found',
      userGuidance: 'Микрофон не обнаружен. Проверьте подключение гарнитуры.',
    };
  }
  return {
    status: 'unknown_error',
    userGuidance: 'Не удалось запустить микрофон. Попробуйте перезагрузить страницу.',
  };
}

// 5. Deafen & Mute state interaction policy
function applyDeafenState(isDeafening, prevMutedState) {
  if (isDeafening) {
    // When deafening, microphone MUST be muted to prevent talking while deaf
    return {
      isDeafened: true,
      isMuted: true,
      storedPreDeafenMute: prevMutedState,
    };
  } else {
    // When undeafening, restore prior user mute state
    return {
      isDeafened: false,
      isMuted: prevMutedState,
    };
  }
}

describe('Frontend Component & State Policy Unit Tests', () => {
  it('Lobby: generates 6-character room codes without ambiguous 0/O/1/I characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateLobbyRoomId();
      assert.strictEqual(code.length, 6);
      assert.strictEqual(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(code), true);
      assert.strictEqual(/[01OI]/.test(code), false, 'Must not contain 0, 1, O, I');
    }
  });

  it('Lobby: sanitizes user room code input cleanly', () => {
    assert.strictEqual(sanitizeLobbyRoomInput('  abc-123  '), 'ABC-123');
    assert.strictEqual(sanitizeLobbyRoomInput('room@!#99'), 'ROOM99');
  });

  it('Update Modal: generates in-room warning during active call', () => {
    const inRoomUI = resolveUpdateModalUI('available', true);
    assert.strictEqual(inRoomUI.showWarning, true);
    assert.ok(inRoomUI.warningText?.includes('разорвет активное соединение'));

    const lobbyUI = resolveUpdateModalUI('available', false);
    assert.strictEqual(lobbyUI.showWarning, false);
    assert.strictEqual(lobbyUI.warningText, null);
  });

  it('Update Modal: locks modal close during downloading and installing', () => {
    assert.strictEqual(resolveUpdateModalUI('downloading', false).isLockedProgress, true);
    assert.strictEqual(resolveUpdateModalUI('installing', false).isLockedProgress, true);
    assert.strictEqual(resolveUpdateModalUI('available', false).isLockedProgress, false);
    assert.strictEqual(resolveUpdateModalUI('error', false).isLockedProgress, false);
  });

  it('Audio Device: falls back to default when previously selected device is disconnected', () => {
    const connectedDevices = [
      { deviceId: 'default', label: 'Default' },
      { deviceId: 'mic-usb-1', label: 'USB Microphone' },
    ];

    // Connected device is kept
    assert.strictEqual(resolveAudioDeviceFallback('mic-usb-1', connectedDevices), 'mic-usb-1');

    // Unplugged device falls back to default
    assert.strictEqual(resolveAudioDeviceFallback('mic-bluetooth-unplugged', connectedDevices), 'default');
  });

  it('Microphone Error: produces actionable guidance when permission is denied', () => {
    const permError = { name: 'NotAllowedError' };
    const res = handleMicrophoneError(permError);
    assert.strictEqual(res.status, 'permission_denied');
    assert.ok(res.userGuidance.includes('Разрешите доступ в настройках'));

    const notFoundError = { name: 'NotFoundError' };
    const res2 = handleMicrophoneError(notFoundError);
    assert.strictEqual(res2.status, 'device_not_found');
    assert.ok(res2.userGuidance.includes('Микрофон не обнаружен'));
  });

  it('Deafen/Mute: auto-mutes when deafened and restores prior state on undeafen', () => {
    // User was unmuted, then deafens
    const step1 = applyDeafenState(true, false);
    assert.strictEqual(step1.isDeafened, true);
    assert.strictEqual(step1.isMuted, true);
    assert.strictEqual(step1.storedPreDeafenMute, false);

    // User undeafens -> restored to unmuted
    const step2 = applyDeafenState(false, step1.storedPreDeafenMute);
    assert.strictEqual(step2.isDeafened, false);
    assert.strictEqual(step2.isMuted, false);

    // User was already muted, then deafens
    const step3 = applyDeafenState(true, true);
    assert.strictEqual(step3.storedPreDeafenMute, true);

    // User undeafens -> stays muted
    const step4 = applyDeafenState(false, step3.storedPreDeafenMute);
    assert.strictEqual(step4.isMuted, true);
  });
});
