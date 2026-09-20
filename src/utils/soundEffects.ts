/**
 * Sound effects utility for UI audio cues (mute, unmute, test sound)
 * Uses Web Audio API oscillator synthesis - zero external audio files required, zero latency.
 */

let fallbackAudioCtx: AudioContext | null = null;
let currentOutputSinkId: string = '';

function getFallbackAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!fallbackAudioCtx || fallbackAudioCtx.state === 'closed') {
      fallbackAudioCtx = new AudioContextClass();
    }
    return fallbackAudioCtx;
  } catch (e) {
    console.warn('[SoundEffects] Failed to create AudioContext:', e);
    return null;
  }
}

// User-gesture unlocker
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getFallbackAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}
  };
  window.addEventListener('click', unlockAudio, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
}

export function setSoundOutputDevice(sinkId: string) {
  currentOutputSinkId = sinkId;
  const ctx = getFallbackAudioContext();
  if (ctx && typeof (ctx as any).setSinkId === 'function') {
    try {
      (ctx as any).setSinkId(sinkId).catch((err: any) => {
        console.warn('[SoundEffects] Failed to set sinkId on AudioContext:', err);
      });
    } catch {}
  }
}

/**
 * Play a smooth synthesized tone with gain envelope
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume = 0.22,
  type: OscillatorType = 'sine'
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    // Smooth envelope: 15ms linear attack, smooth exponential decay to avoid clicks
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  } catch (e) {
    console.warn('[SoundEffects] Failed to play tone:', e);
  }
}

/**
 * Sound when muting (turning mic off):
 * Two descending soft tones (540 Hz -> 380 Hz)
 */
export async function playMuteSound() {
  const ctx = getFallbackAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    playTone(ctx, 540, now, 0.09, 0.25, 'sine');
    playTone(ctx, 380, now + 0.08, 0.12, 0.25, 'sine');
  } catch (e) {
    console.warn('[SoundEffects] playMuteSound error:', e);
  }
}

/**
 * Sound when unmuting (turning mic on):
 * Two ascending soft tones (380 Hz -> 540 Hz)
 */
export async function playUnmuteSound() {
  const ctx = getFallbackAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    playTone(ctx, 380, now, 0.09, 0.25, 'sine');
    playTone(ctx, 540, now + 0.08, 0.12, 0.25, 'sine');
  } catch (e) {
    console.warn('[SoundEffects] playUnmuteSound error:', e);
  }
}

/**
 * Test sound for checking output device / speakers
 * Three ascending notes (A major arpeggio: 440Hz -> 554Hz -> 659Hz)
 */
export async function playTestSound() {
  const ctx = getFallbackAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    playTone(ctx, 440, now, 0.12, 0.22, 'sine');
    playTone(ctx, 554, now + 0.10, 0.12, 0.22, 'sine');
    playTone(ctx, 659, now + 0.20, 0.18, 0.25, 'sine');
  } catch (e) {
    console.warn('[SoundEffects] playTestSound error:', e);
  }
}

/**
 * Sound when a user joins the room (for self and peers):
 * Three quick bright ascending notes (D4 -> F#4 -> A4: 293.66Hz -> 369.99Hz -> 440Hz)
 */
export async function playJoinSound() {
  const ctx = getFallbackAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    playTone(ctx, 330, now, 0.08, 0.22, 'sine');
    playTone(ctx, 440, now + 0.07, 0.08, 0.22, 'sine');
    playTone(ctx, 660, now + 0.14, 0.16, 0.25, 'sine');
  } catch (e) {
    console.warn('[SoundEffects] playJoinSound error:', e);
  }
}

/**
 * Sound when a user leaves the room (for self and peers):
 * Three quick soft descending notes (660Hz -> 440Hz -> 330Hz)
 */
export async function playLeaveSound() {
  const ctx = getFallbackAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    playTone(ctx, 660, now, 0.08, 0.22, 'sine');
    playTone(ctx, 440, now + 0.07, 0.08, 0.22, 'sine');
    playTone(ctx, 330, now + 0.14, 0.16, 0.20, 'sine');
  } catch (e) {
    console.warn('[SoundEffects] playLeaveSound error:', e);
  }
}
