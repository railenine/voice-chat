export const APP_VERSION = '0.1.14';
export const PRODUCTION_SERVER = 'https://rvxis.site';
export const PRODUCTION_WS = 'wss://rvxis.site/peerjs/ws';

// Maximum participants in a single Full-Mesh P2P room (default: 12)
export const MAX_ROOM_PEERS = 12;

// ⚠️ LOCAL TESTING FLAG (Set to true when running manual tests against localhost)
const USE_LOCAL_SERVER_FOR_TAURI_TESTS = false;
const LOCAL_DEV_SERVER = 'http://localhost:3000';
const LOCAL_DEV_WS = 'ws://localhost:3000/peerjs/ws';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export function getBackendBaseUrl(): string {
  if (isTauri()) {
    return USE_LOCAL_SERVER_FOR_TAURI_TESTS ? LOCAL_DEV_SERVER : PRODUCTION_SERVER;
  }
  const isDev =
    typeof window !== 'undefined' &&
    (window.location.port === '5173' || window.location.port === '5174');

  if (isDev) {
    return `http://${window.location.hostname}:3000`;
  }
  return typeof window !== 'undefined' ? window.location.origin : PRODUCTION_SERVER;
}

export function getWebSocketUrl(): string {
  if (isTauri()) {
    return USE_LOCAL_SERVER_FOR_TAURI_TESTS ? LOCAL_DEV_WS : PRODUCTION_WS;
  }
  const isDev =
    window.location.port === '5173' ||
    window.location.port === '5174' ||
    (window.location.port === '3000' && window.location.hostname === 'localhost');

  if (isDev) {
    return `ws://${window.location.hostname}:3000/peerjs/ws`;
  }
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${window.location.host}/peerjs/ws`;
}

export function getShareUrl(roomId: string): string {
  if (isTauri()) {
    const base = USE_LOCAL_SERVER_FOR_TAURI_TESTS ? LOCAL_DEV_SERVER : PRODUCTION_SERVER;
    return `${base}?room=${roomId}`;
  }
  return `${window.location.origin}?room=${roomId}`;
}
