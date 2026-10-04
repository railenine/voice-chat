/**
 * Pure volume normalization, clamping, and persistence policies.
 */

export function clampVolume(volume: number): number {
  return Math.max(0, Math.min(200, Math.round(volume)));
}

export interface VolumeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Reads saved volume for a peer from storage (peerId first, then nickname fallback).
 * Returns integer in range [0, 200], default 100.
 */
export function getSavedPeerVolume(
  storage: VolumeStorageLike | null | undefined,
  peerId: string,
  nick?: string
): number {
  if (!storage) return 100;
  try {
    if (peerId) {
      const v = storage.getItem(`peer_volume_id_${peerId}`);
      if (v !== null) {
        const num = Number(v);
        if (!isNaN(num) && num >= 0 && num <= 200) return num;
      }
    }
    if (nick) {
      const v = storage.getItem(`peer_volume_${nick}`);
      if (v !== null) {
        const num = Number(v);
        if (!isNaN(num) && num >= 0 && num <= 200) return num;
      }
    }
  } catch {}
  return 100;
}

/**
 * Saves volume for a peer to storage, clamping to [0, 200].
 */
export function savePeerVolume(
  storage: VolumeStorageLike | null | undefined,
  peerId: string,
  volume: number,
  nick?: string
): number {
  const clamped = clampVolume(volume);
  if (!storage) return clamped;
  try {
    storage.setItem(`peer_volume_id_${peerId}`, String(clamped));
    if (nick) {
      storage.setItem(`peer_volume_${nick}`, String(clamped));
    }
  } catch {}
  return clamped;
}
