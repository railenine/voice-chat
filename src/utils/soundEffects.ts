/**
 * Sound effects utility for UI audio cues (mute, unmute, etc.)
 * Uses Web Audio API oscillator synthesis - zero external audio files required, zero latency.
 */

let fallbackAudioCtx: AudioContext | null = null;

function getFallbackAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!fallbackAudioCtx || fallbackAudioCtx.state === 'closed') {
      fallbackAudioCtx = new AudioContextClass();
    }
    if (fallbackAudioCtx.state === 'suspended') {
      fallbackAudioCtx.resume().catch(() => {});
    }
    return fallbackAudioCtx;
  } catch {
    return null;
  }
}

function resolveAudioContext(customCtx?: AudioContext | null): AudioContext | null {
  if (customCtx && customCtx.state !== 'closed') {
    if (customCtx.state === 'suspended') {
      customCtx.resume().catch(() => {});
    }
    return customCtx;
  }
  return getFallbackAudioContext();
}

/**
 * Play a smooth tone with gain envelope to prevent clicking/popping
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume = 0.12,
  type: OscillatorType = 'sine'
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    // Smooth envelope: 15ms linear attack, smooth exponential decay
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch (e) {
    console.warn('[SoundEffects] Failed to play tone:', e);
  }
}

/**
 * Sound when muting (turning mic off):
 * Two descending soft tones (520 Hz -> 380 Hz)
 */
export function playMuteSound(customCtx?: AudioContext | null) {
  const ctx = resolveAudioContext(customCtx);
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(ctx, 520, now, 0.08, 0.12, 'sine');
  playTone(ctx, 380, now + 0.07, 0.11, 0.12, 'sine');
}

/**
 * Sound when unmuting (turning mic on):
 * Two ascending soft tones (380 Hz -> 520 Hz)
 */
export function playUnmuteSound(customCtx?: AudioContext | null) {
  const ctx = resolveAudioContext(customCtx);
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(ctx, 380, now, 0.08, 0.12, 'sine');
  playTone(ctx, 520, now + 0.07, 0.11, 0.12, 'sine');
}
