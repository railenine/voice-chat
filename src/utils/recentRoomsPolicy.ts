import { extractRoomId } from './nicknames.ts';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RecentRoom {
  roomId: string;
  lastVisited: number; // Unix timestamp in ms
}

export const RECENT_ROOMS_STORAGE_KEY = 'rvxis_recent_rooms';
export const MAX_RECENT_ROOMS = 3;

function getSafeLocalStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {}
  return null;
}

/**
 * Loads the list of recent rooms from storage.
 * Gracefully handles missing, corrupted, or invalid JSON.
 */
export function getRecentRooms(storage?: StorageLike | null): RecentRoom[] {
  const store = storage !== undefined ? storage : getSafeLocalStorage();
  if (!store) return [];

  try {
    const raw = store.getItem(RECENT_ROOMS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const cleanId = extractRoomId(String(item.roomId || ''));
        const time = Number(item.lastVisited);
        if (!cleanId || isNaN(time) || time <= 0) return null;
        return {
          roomId: cleanId,
          lastVisited: Math.round(time),
        };
      })
      .filter((item): item is RecentRoom => item !== null)
      .slice(0, MAX_RECENT_ROOMS);
  } catch {
    return [];
  }
}

/**
 * Adds or updates a room in the recent rooms list.
 * If the room already exists, moves it to the top with an updated timestamp.
 * Keeps at most MAX_RECENT_ROOMS items.
 */
export function addRecentRoom(
  rawRoomId: string,
  timestamp: number = Date.now(),
  storage?: StorageLike | null
): RecentRoom[] {
  const cleanId = extractRoomId(rawRoomId);
  if (!cleanId || cleanId.length < 3) {
    return getRecentRooms(storage);
  }

  const store = storage !== undefined ? storage : getSafeLocalStorage();
  const current = getRecentRooms(store);

  // Filter out existing occurrence of this room
  const filtered = current.filter((r) => r.roomId !== cleanId);

  // Prepend new entry
  const updated: RecentRoom[] = [
    { roomId: cleanId, lastVisited: Math.round(timestamp) },
    ...filtered,
  ].slice(0, MAX_RECENT_ROOMS);

  if (store) {
    try {
      store.setItem(RECENT_ROOMS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  return updated;
}

/**
 * Removes a specific room from the recent list.
 */
export function removeRecentRoom(
  rawRoomId: string,
  storage?: StorageLike | null
): RecentRoom[] {
  const cleanId = extractRoomId(rawRoomId);
  const store = storage !== undefined ? storage : getSafeLocalStorage();
  const current = getRecentRooms(store);

  const updated = current.filter((r) => r.roomId !== cleanId);

  if (store) {
    try {
      store.setItem(RECENT_ROOMS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  return updated;
}

/**
 * Clears the entire recent rooms history.
 */
export function clearRecentRooms(storage?: StorageLike | null): void {
  const store = storage !== undefined ? storage : getSafeLocalStorage();
  if (store) {
    try {
      store.setItem(RECENT_ROOMS_STORAGE_KEY, JSON.stringify([]));
    } catch {}
  }
}

/**
 * Formats a visit timestamp into a compact, human-readable relative time.
 * Examples: 'только что', '5 мин назад', '2 ч назад', 'вчера', '12 окт.'
 */
export function formatRecentTime(timestamp: number, now: number = Date.now()): string {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) return '';

  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return 'только что';
  }

  if (diffMin < 60) {
    return `${diffMin} мин назад`;
  }

  if (diffHours < 24) {
    return `${diffHours} ч назад`;
  }

  const visitDate = new Date(timestamp);
  const nowDate = new Date(now);

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(nowDate.getDate() - 1);
  if (
    visitDate.getDate() === yesterday.getDate() &&
    visitDate.getMonth() === yesterday.getMonth() &&
    visitDate.getFullYear() === yesterday.getFullYear()
  ) {
    return 'вчера';
  }

  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const day = visitDate.getDate();
  const month = months[visitDate.getMonth()] || '';

  return `${day} ${month}`;
}
