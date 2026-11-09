// Room credentials are tab-local and never included in share URLs or chat messages.
const tokens = new Map<string, string>();
const validToken = (token: unknown): token is string => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export function getRoomToken(roomId: string): string {
  const cached = tokens.get(roomId);
  if (validToken(cached)) return cached;
  try {
    const stored = sessionStorage.getItem(`rvxis_session_${roomId}`);
    if (validToken(stored)) return stored;
    sessionStorage.removeItem(`rvxis_session_${roomId}`);
  } catch {}
  return '';
}
export function setRoomToken(roomId: string, token: unknown): void {
  if (!validToken(token)) {
    tokens.delete(roomId);
    try { sessionStorage.removeItem(`rvxis_session_${roomId}`); } catch {}
    return;
  }
  tokens.set(roomId, token);
  try { sessionStorage.setItem(`rvxis_session_${roomId}`, token); } catch {}
}
export function roomAuthorization(roomId: string): Record<string, string> {
  const token = getRoomToken(roomId);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
