// Room credentials are tab-local and never included in share URLs or chat messages.
const tokens = new Map<string, string>();
export function getRoomToken(roomId: string): string {
  try { return tokens.get(roomId) || sessionStorage.getItem(`rvxis_session_${roomId}`) || ''; }
  catch { return tokens.get(roomId) || ''; }
}
export function setRoomToken(roomId: string, token: string): void {
  tokens.set(roomId, token);
  try { sessionStorage.setItem(`rvxis_session_${roomId}`, token); } catch {}
}
export function roomAuthorization(roomId: string): Record<string, string> {
  return { Authorization: `Bearer ${getRoomToken(roomId)}` };
}
