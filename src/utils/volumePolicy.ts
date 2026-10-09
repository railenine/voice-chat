/**
 * Pure volume normalization, clamping, and persistence policies.
 */

export function clampVolume(volume: number): number {
  return Math.max(0, Math.min(200, Math.round(volume)));
}

/**
 * Maps a volume percentage [0, 200] to a linear audio gain multiplier.
 * - 0% -> 0.0 (mute)
 * - 100% -> 1.0 (unity gain, 0 dB)
 * - >100% -> Smooth boost up to 2.5x (+7.96 dB / ~+8 dB) at 200% for quiet mics.
 */
export function calculateVolumeGain(volume: number): number {
  const clamped = clampVolume(volume);
  if (clamped <= 0) return 0;
  if (clamped <= 100) {
    return clamped / 100;
  }
  // For 101% - 200%: smooth scaling from 1.0 up to 2.5 (an additional +1.5 gain)
  return 1.0 + ((clamped - 100) / 100) * 1.5;
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
