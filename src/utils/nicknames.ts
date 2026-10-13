const adjectives = [
  'Быстрый', 'Тихий', 'Мудрый', 'Смелый', 'Весёлый',
  'Добрый', 'Храбрый', 'Ловкий', 'Грозный', 'Спокойный',
  'Яркий', 'Тёмный', 'Золотой', 'Серебряный', 'Огненный',
  'Ледяной', 'Громовой', 'Ветреный', 'Звёздный', 'Лунный',
  'Солнечный', 'Таинственный', 'Невидимый', 'Могучий', 'Свободный',
  'Swift', 'Silent', 'Brave', 'Mighty', 'Cosmic',
  'Neon', 'Pixel', 'Cyber', 'Retro', 'Hyper'
];

const nouns = [
  'Волк', 'Тигр', 'Орёл', 'Дракон', 'Феникс',
  'Лев', 'Медведь', 'Ястреб', 'Пантера', 'Лис',
  'Кот', 'Пёс', 'Сова', 'Дельфин', 'Кит',
  'Тигр', 'Рысь', 'Ворон', 'Сокол', 'Змей',
  'Wolf', 'Tiger', 'Eagle', 'Dragon', 'Phoenix',
  'Lion', 'Hawk', 'Panther', 'Fox', 'Owl'
];

export function generateNickname(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Extracts a clean room ID from a raw string, URL (e.g. https://rvxis.site?room=8BH5DA),
 * query parameter, or path.
 */
export function extractRoomId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // 1. If it's a URL or contains query parameters
  try {
    const urlString = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://dummy.com/${trimmed.startsWith('?') ? '' : '?'}${trimmed}`;
    const url = new URL(urlString);
    const roomParam = url.searchParams.get('room');
    if (roomParam) {
      return roomParam.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    }

    // Check path segments (e.g. /room/8BH5DA or /8BH5DA)
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      if (last.length >= 4 && last.length <= 10 && /^[a-zA-Z0-9]+$/.test(last)) {
        return last.toUpperCase().slice(0, 10);
      }
    }
  } catch {}

  // 2. Regex fallback for room=XXXX
  const match = trimmed.match(/[?&]room=([a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return match[1].toUpperCase().slice(0, 10);
  }

  // 3. Raw input: keep only alphanumeric characters, uppercase, up to 10 chars
  return trimmed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const NICKNAME_STORAGE_KEY = 'rvxis_nickname';
export const LEGACY_NICKNAME_STORAGE_KEYS = ['voice_chat_nickname', 'voicechat-nickname'] as const;

function getSafeStorage(type: 'local' | 'session'): StorageLike | null {
  try {
    if (typeof window !== 'undefined') {
      const storage = type === 'local' ? window.localStorage : window.sessionStorage;
      if (storage) return storage;
    }
  } catch {}
  return null;
}

export function normalizeNickname(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 24);
}

export function isValidNickname(nick: string): boolean {
  if (typeof nick !== 'string') return false;
  const trimmed = nick.trim();
  return trimmed.length >= 1 && trimmed.length <= 24;
}

/**
 * Loads the user's permanent nickname from persistent storage (localStorage).
 * Seamlessly migrates existing nicknames from legacy keys and previous sessions.
 * If no valid nickname exists, generates a fresh random nickname, persists it, and returns it.
 */
export function getStoredNickname(
  preferredStorage?: StorageLike | null,
  fallbackStorage?: StorageLike | null
): string {
  const localStorageObj = preferredStorage !== undefined ? preferredStorage : getSafeStorage('local');
  const sessionStorageObj = fallbackStorage !== undefined ? fallbackStorage : getSafeStorage('session');

  // 1. Primary key in localStorage
  if (localStorageObj) {
    try {
      const primary = normalizeNickname(localStorageObj.getItem(NICKNAME_STORAGE_KEY));
      if (isValidNickname(primary)) {
        return primary;
      }
    } catch {}

    // 2. Legacy keys in localStorage
    for (const legacyKey of LEGACY_NICKNAME_STORAGE_KEYS) {
      try {
        const legacy = normalizeNickname(localStorageObj.getItem(legacyKey));
        if (isValidNickname(legacy)) {
          try {
            localStorageObj.setItem(NICKNAME_STORAGE_KEY, legacy);
          } catch {}
          return legacy;
        }
      } catch {}
    }
  }

  // 3. Check sessionStorage (e.g. from session immediately preceding this update)
  if (sessionStorageObj) {
    try {
      const sessionPrimary = normalizeNickname(sessionStorageObj.getItem(NICKNAME_STORAGE_KEY));
      if (isValidNickname(sessionPrimary)) {
        if (localStorageObj) {
          try {
            localStorageObj.setItem(NICKNAME_STORAGE_KEY, sessionPrimary);
          } catch {}
        }
        return sessionPrimary;
      }
    } catch {}

    for (const legacyKey of LEGACY_NICKNAME_STORAGE_KEYS) {
      try {
        const sessionLegacy = normalizeNickname(sessionStorageObj.getItem(legacyKey));
        if (isValidNickname(sessionLegacy)) {
          if (localStorageObj) {
            try {
              localStorageObj.setItem(NICKNAME_STORAGE_KEY, sessionLegacy);
            } catch {}
          }
          return sessionLegacy;
        }
      } catch {}
    }
  }

  // 4. Fallback: generate fresh nickname and save permanently
  const freshNick = generateNickname();
  saveStoredNickname(freshNick, localStorageObj, sessionStorageObj);
  return freshNick;
}

/**
 * Permanently saves the user's nickname to persistent storage (localStorage).
 * Also keeps legacy and session keys synchronized for seamless compatibility.
 * Returns the normalized nickname, or empty string if input was invalid.
 */
export function saveStoredNickname(
  nick: string,
  preferredStorage?: StorageLike | null,
  fallbackStorage?: StorageLike | null
): string {
  const normalized = normalizeNickname(nick);
  if (!isValidNickname(normalized)) {
    return '';
  }

  const localStorageObj = preferredStorage !== undefined ? preferredStorage : getSafeStorage('local');
  const sessionStorageObj = fallbackStorage !== undefined ? fallbackStorage : getSafeStorage('session');

  if (localStorageObj) {
    try {
      localStorageObj.setItem(NICKNAME_STORAGE_KEY, normalized);
      for (const legacyKey of LEGACY_NICKNAME_STORAGE_KEYS) {
        localStorageObj.setItem(legacyKey, normalized);
      }
    } catch {}
  }

  if (sessionStorageObj) {
    try {
      sessionStorageObj.setItem(NICKNAME_STORAGE_KEY, normalized);
      for (const legacyKey of LEGACY_NICKNAME_STORAGE_KEYS) {
        sessionStorageObj.setItem(legacyKey, normalized);
      }
    } catch {}
  }

  return normalized;
}
