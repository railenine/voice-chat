/**
 * Sound effects utility for UI audio cues (mute, unmute, join, leave, test sound)
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
 * Play a polyphonic harmonic chime note (multiple frequencies at once)
 * Produces rich acoustic bell/chime tones with exponential decay
 */
function playHarmonicChime(
  ctx: AudioContext,
  frequencies: number[],
  startTime: number,
  duration: number,
  volume = 0.25,
  type: OscillatorType = 'sine'
) {
  try {
    const gain = ctx.createGain();
    const perVoiceVolume = volume / Math.sqrt(frequencies.length);

    // Fast attack (12ms), long exponential bell decay
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(perVoiceVolume, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    frequencies.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.connect(gain);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    });

    gain.connect(ctx.destination);
  } catch (e) {
    console.warn('[SoundEffects] playHarmonicChime error:', e);
  }
}

/**
 * Play a short tactile UI click/chirp with frequency sweep (for mic buttons)
 */
function playTactileSweep(
  ctx: AudioContext,
  startFreq: number,
  endFreq: number,
  startTime: number,
  duration: number,
  volume = 0.18
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  } catch (e) {
    console.warn('[SoundEffects] playTactileSweep error:', e);
  }
}

/**
 * Mute sound (Microphone OFF):
 * Short, subtle tactile click down (360 Hz -> 180 Hz, 55ms)
 * Sounds like a physical switch clicking off.
 */
export async function playMuteSound() {
  const ctx = getFallbackAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    playTactileSweep(ctx, 360, 180, now, 0.055, 0.22);
  } catch (e) {
    console.warn('[SoundEffects] playMuteSound error:', e);
  }
}

/**
 * Unmute sound (Microphone ON):
 * Short, crisp tactile click up (220 Hz -> 480 Hz, 55ms)
 * Sounds like a physical switch clicking on.
 */
export async function playUnmuteSound() {
  const ctx = getFallbackAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    playTactileSweep(ctx, 220, 480, now, 0.055, 0.22);
  } catch (e) {
    console.warn('[SoundEffects] playUnmuteSound error:', e);
  }
}

/**
 * Sound when user or a peer joins the room:
 * Rich two-stage harmonic entrance chime (Discord / Slack style):
 * - Stage 1 (0ms): Warm fifth interval [C5: 523.25 Hz + G5: 783.99 Hz]
 * - Stage 2 (120ms): Bright major triad [E5: 659.25 Hz + B5: 987.77 Hz + E6: 1318.51 Hz] with ringing decay (380ms)
 */
export async function playJoinSound() {
  const ctx = getFallbackAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    // Step 1: Warm opening chord
    playHarmonicChime(ctx, [523.25, 783.99], now, 0.16, 0.22, 'sine');
    // Step 2: Sparkling resolution chord with shimmering decay
    playHarmonicChime(ctx, [659.25, 987.77, 1318.51], now + 0.12, 0.38, 0.26, 'sine');
  } catch (e) {
    console.warn('[SoundEffects] playJoinSound error:', e);
  }
}

/**
 * Sound when user or a peer leaves the room:
 * Two-stage downward warm chord:
 * - Stage 1 (0ms): High fifth [E5: 659.25 Hz + B5: 987.77 Hz] (120ms)
 * - Stage 2 (110ms): Low warm resonant resolution [A4: 440 Hz + E5: 659.25 Hz + A3: 220 Hz] (320ms decay)
 */
export async function playLeaveSound() {
  const ctx = getFallbackAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    // Step 1: Descending intro
    playHarmonicChime(ctx, [659.25, 987.77], now, 0.14, 0.22, 'sine');
    // Step 2: Low warm departure chord
    playHarmonicChime(ctx, [440.0, 659.25, 220.0], now + 0.11, 0.32, 0.24, 'sine');
  } catch (e) {
    console.warn('[SoundEffects] playLeaveSound error:', e);
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
    playHarmonicChime(ctx, [440, 880], now, 0.14, 0.20, 'sine');
    playHarmonicChime(ctx, [554.37, 1108.73], now + 0.11, 0.14, 0.20, 'sine');
    playHarmonicChime(ctx, [659.25, 1318.51], now + 0.22, 0.28, 0.24, 'sine');
  } catch (e) {
    console.warn('[SoundEffects] playTestSound error:', e);
  }
}
