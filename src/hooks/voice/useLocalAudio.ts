import { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import { playMuteSound, playUnmuteSound } from '../../utils/soundEffects';

const SILENT_AUDIO_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export interface UseLocalAudioProps {
  audioInputDeviceId?: string;
  audioOutputDeviceId?: string;
  peerConnectionsRef: MutableRefObject<Map<string, RTCPeerConnection>>;
  onAudioUnlocked?: () => void;
}

export function useLocalAudio({
  audioInputDeviceId,
  audioOutputDeviceId,
  peerConnectionsRef,
  onAudioUnlocked,
}: UseLocalAudioProps) {
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const [isNoiseSuppression, setIsNoiseSuppression] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('voice_chat_rnnoise');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });
  const isNoiseSuppressionRef = useRef(isNoiseSuppression);
  const [isNoiseSuppressionReady, setIsNoiseSuppressionReady] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rawMicStreamRef = useRef<MediaStream | null>(null);

  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micPreFilterNodeRef = useRef<BiquadFilterNode | null>(null);
  const micPostFilterNodeRef = useRef<BiquadFilterNode | null>(null);
  const micHighCutNodeRef = useRef<BiquadFilterNode | null>(null);
  const micGateGainNodeRef = useRef<GainNode | null>(null);
  const rnnoiseNodeRef = useRef<RnnoiseWorkletNode | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micMergerNodeRef = useRef<ChannelMergerNode | null>(null);

  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const audioOutputDeviceIdRef = useRef(audioOutputDeviceId);
  audioOutputDeviceIdRef.current = audioOutputDeviceId;

  const onAudioUnlockedRef = useRef(onAudioUnlocked);
  onAudioUnlockedRef.current = onAudioUnlocked;

  // Start silent loop to keep audio pipeline active in background on mobile (iOS Safari & Android Chrome)
  const startSilentLoop = useCallback(() => {
    if (typeof document === 'undefined') return;

    if (!silentAudioRef.current) {
      const audio = document.createElement('audio');
      audio.src = SILENT_AUDIO_URI;
      audio.loop = true;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      (audio as any).playsInline = true;
      (audio as any).webkitPlaysInline = true;
      audio.style.position = 'fixed';
      audio.style.top = '-9999px';
      audio.style.left = '-9999px';
      audio.style.width = '1px';
      audio.style.height = '1px';
      audio.style.opacity = '0.01';
      document.body.appendChild(audio);
      silentAudioRef.current = audio;
    }

    if (silentAudioRef.current && silentAudioRef.current.paused) {
      silentAudioRef.current
        .play()
        .then(() => {
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        })
        .catch(() => {});
    }
  }, []);

  // Helper to ensure AudioContext is initialized and active
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        try {
          audioContextRef.current = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 48000 });
        } catch {
          audioContextRef.current = new AudioContextClass();
        }
        const sinkId = audioOutputDeviceIdRef.current;
        if (sinkId && typeof (audioContextRef.current as any).setSinkId === 'function') {
          (audioContextRef.current as any).setSinkId(sinkId).catch(() => {});
        }
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  // Unlock audio playback (AudioContext & remote audio elements)
  const unlockAudio = useCallback(() => {
    startSilentLoop();

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch((err) => console.warn('[Audio] Resume failed:', err));
    }

    onAudioUnlockedRef.current?.();
    setNeedsAudioUnlock(false);
  }, [startSilentLoop]);

  // Connect/reconnect mic audio graph based on isNoiseSuppression
  const connectMicGraph = useCallback(() => {
    const micSource = micSourceNodeRef.current;
    const rnnoiseNode = rnnoiseNodeRef.current;
    const mediaStreamDest = mediaStreamDestRef.current;
    const analyser = analyserRef.current;

    if (!micSource || !mediaStreamDest) return;

    try {
      micSource.disconnect();
    } catch (e) {}
    if (micPreFilterNodeRef.current) {
      try {
        micPreFilterNodeRef.current.disconnect();
      } catch (e) {}
    }
    if (rnnoiseNode) {
      try {
        rnnoiseNode.disconnect();
      } catch (e) {}
    }
    if (micPostFilterNodeRef.current) {
      try {
        micPostFilterNodeRef.current.disconnect();
      } catch (e) {}
    }
    if (micHighCutNodeRef.current) {
      try {
        micHighCutNodeRef.current.disconnect();
      } catch (e) {}
    }
    if (micGateGainNodeRef.current) {
      try {
        micGateGainNodeRef.current.disconnect();
      } catch (e) {}
    }
    if (micMergerNodeRef.current) {
      try {
        micMergerNodeRef.current.disconnect();
      } catch (e) {}
    }

    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    if (!micMergerNodeRef.current) {
      micMergerNodeRef.current = audioCtx.createChannelMerger(2);
    }
    const micMerger = micMergerNodeRef.current;

    if (isNoiseSuppressionRef.current && rnnoiseNode) {
      // 1. Pre-filter: High-Pass at 90Hz (Q: 0.707) to eliminate desk rumble, wind/breath, and 50/60Hz mains hum
      if (!micPreFilterNodeRef.current) {
        const preFilter = audioCtx.createBiquadFilter();
        preFilter.type = 'highpass';
        preFilter.frequency.value = 90;
        preFilter.Q.value = 0.707;
        micPreFilterNodeRef.current = preFilter;
      }
      const preFilter = micPreFilterNodeRef.current;

      // 2. Post-filter: Peaking EQ at 3200Hz (+0.8dB, Q: 1.0) for speech clarity without boosting white noise
      if (!micPostFilterNodeRef.current) {
        const postFilter = audioCtx.createBiquadFilter();
        postFilter.type = 'peaking';
        postFilter.frequency.value = 3200;
        postFilter.gain.value = 0.8;
        postFilter.Q.value = 1.0;
        micPostFilterNodeRef.current = postFilter;
      }
      const postFilter = micPostFilterNodeRef.current;

      // 3. High-cut filter at 12000Hz (Q: 0.707) to eliminate ultrasonic hiss, coil whine, and mechanical switch clicks
      if (!micHighCutNodeRef.current) {
        const highCut = audioCtx.createBiquadFilter();
        highCut.type = 'lowpass';
        highCut.frequency.value = 12000;
        highCut.Q.value = 0.707;
        micHighCutNodeRef.current = highCut;
      }
      const highCut = micHighCutNodeRef.current;

      // 4. Downward Expander / Adaptive Noise Gate
      if (!micGateGainNodeRef.current) {
        const gate = audioCtx.createGain();
        gate.gain.value = 1.0;
        micGateGainNodeRef.current = gate;
      }
      const gate = micGateGainNodeRef.current;
      gate.gain.setValueAtTime(1.0, audioCtx.currentTime);

      // Chain: micSource -> preFilter -> rnnoiseNode -> postFilter -> highCut -> gate -> micMerger -> mediaStreamDest
      micSource.connect(preFilter);
      preFilter.connect(rnnoiseNode);
      rnnoiseNode.connect(postFilter);
      postFilter.connect(highCut);
      highCut.connect(gate);
      gate.connect(micMerger, 0, 0);
      gate.connect(micMerger, 0, 1);
      micMerger.connect(mediaStreamDest);

      if (analyser) {
        // Analyser listens to audio BEFORE the gate so VAD accurately detects speech onset even when gate is closed
        highCut.connect(analyser);
      }
      console.log(
        '[RNNoise] Enhanced studio filter chain active (HP 90Hz + RNNoise + Clarity EQ + HighCut 12kHz + Adaptive Gate)'
      );
    } else {
      // Noise suppression bypassed: direct pass-through
      if (micGateGainNodeRef.current) {
        micGateGainNodeRef.current.gain.setValueAtTime(1.0, audioCtx.currentTime);
      }
      micSource.connect(micMerger, 0, 0);
      micSource.connect(micMerger, 0, 1);
      micMerger.connect(mediaStreamDest);

      if (analyser) {
        micSource.connect(analyser);
      }
      console.log('[RNNoise] Filter bypassed (direct pass-through)');
    }
  }, []);

  // Toggle noise suppression state
  const toggleNoiseSuppression = useCallback(() => {
    const next = !isNoiseSuppressionRef.current;
    isNoiseSuppressionRef.current = next;
    setIsNoiseSuppression(next);
    try {
      localStorage.setItem('voice_chat_rnnoise', String(next));
    } catch (e) {}
    connectMicGraph();
  }, [connectMicGraph]);

  // Set mute state with audio tracks update
  const setMicrophoneMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
    setIsMuted(muted);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (rawMicStreamRef.current) {
      rawMicStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }, []);

  // Toggle microphone mute
  const toggleMute = useCallback(
    (onMutedChanged?: (newMuted: boolean) => void) => {
      const newMuted = !isMutedRef.current;
      setMicrophoneMuted(newMuted);

      if (newMuted) {
        playMuteSound();
      } else {
        playUnmuteSound();
      }

      onMutedChanged?.(newMuted);
    },
    [setMicrophoneMuted]
  );

  // Initialize local microphone & RNNoise audio graph
  const initLocalAudio = useCallback(
    async (inputDeviceId?: string): Promise<MediaStream> => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'Ваш браузер не поддерживает доступ к микрофону или страница открыта не по HTTPS.'
        );
      }

      let rawStream: MediaStream;
      const micConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      if (inputDeviceId) {
        micConstraints.deviceId = { exact: inputDeviceId };
      }

      try {
        rawStream = await navigator.mediaDevices.getUserMedia({
          audio: micConstraints,
        });
      } catch (firstErr) {
        console.warn(
          'Advanced/device audio constraints failed, falling back to basic audio: true',
          firstErr
        );
        rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const rawAudioTrack = rawStream.getAudioTracks()[0];
      if (!rawAudioTrack) {
        throw new Error('Микрофон не вернул аудиодорожку.');
      }
      rawAudioTrack.enabled = !isMutedRef.current;
      rawMicStreamRef.current = rawStream;

      // Setup Web Audio API and RNNoise Worklet
      const audioContext = getAudioContext();
      if (audioContext) {
        const micSource = audioContext.createMediaStreamSource(rawStream);
        micSourceNodeRef.current = micSource;

        const mediaStreamDest = audioContext.createMediaStreamDestination();
        mediaStreamDestRef.current = mediaStreamDest;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        analyserRef.current = analyser;

        try {
          console.log('[RNNoise] Loading WASM and AudioWorklet module...');
          const wasmBinary = await loadRnnoise({
            url: rnnoiseWasmUrl,
            simdUrl: rnnoiseSimdWasmUrl,
          });
          await audioContext.audioWorklet.addModule(rnnoiseWorkletUrl);
          const rnnoiseNode = new RnnoiseWorkletNode(audioContext, {
            maxChannels: 1,
            wasmBinary,
          });
          rnnoiseNodeRef.current = rnnoiseNode;
          setIsNoiseSuppressionReady(true);
          console.log('[RNNoise] Initialized successfully');
        } catch (rnErr) {
          console.warn('[RNNoise] Initialization failed, will use direct pass-through:', rnErr);
        }

        connectMicGraph();
        streamRef.current = mediaStreamDest.stream;
      } else {
        streamRef.current = rawStream;
      }

      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current;
      });

      return streamRef.current;
    },
    [getAudioContext, connectMicGraph]
  );

  // Switch microphone input device dynamically during active call
  const prevInputDeviceRef = useRef<string | undefined>(audioInputDeviceId);
  useEffect(() => {
    if (!rawMicStreamRef.current) return;
    if (prevInputDeviceRef.current === audioInputDeviceId) return;
    prevInputDeviceRef.current = audioInputDeviceId;

    const switchMic = async () => {
      try {
        console.log(`[Audio] Switching input device to: ${audioInputDeviceId || 'default'}`);
        const constraints: MediaStreamConstraints = {
          audio: audioInputDeviceId
            ? {
                deviceId: { exact: audioInputDeviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            : {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
        };
        let newRawStream: MediaStream;
        try {
          newRawStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (deviceErr) {
          console.warn('[Audio] Failed with exact input device, falling back to default mic:', deviceErr);
          newRawStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        }
        const newRawTrack = newRawStream.getAudioTracks()[0];
        if (!newRawTrack) return;

        if (rawMicStreamRef.current) {
          rawMicStreamRef.current.getAudioTracks().forEach((t) => t.stop());
        }
        rawMicStreamRef.current = newRawStream;
        newRawTrack.enabled = !isMutedRef.current;

        const audioCtx = getAudioContext();
        if (audioCtx) {
          if (micSourceNodeRef.current) {
            try {
              micSourceNodeRef.current.disconnect();
            } catch (e) {}
          }
          micSourceNodeRef.current = audioCtx.createMediaStreamSource(newRawStream);
        }

        connectMicGraph();

        const activeTrack = streamRef.current?.getAudioTracks()[0] || newRawTrack;
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => !s.track || s.track.kind === 'audio');
          if (sender && activeTrack) {
            sender.replaceTrack(activeTrack).catch((err) => {
              console.warn('[WebRTC] Error replacing track on device change:', err);
            });
          }
        });
      } catch (err) {
        console.warn('[Audio] Failed to switch microphone device:', err);
      }
    };

    switchMic();
  }, [audioInputDeviceId, connectMicGraph, getAudioContext, peerConnectionsRef]);

  // Auto-unlock AudioContext, Screen WakeLock, and mobile background audio retention (iOS & Android)
  useEffect(() => {
    const requestWakeLock = async () => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        try {
          if (!wakeLockRef.current) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            console.log('[WakeLock] Screen wake lock acquired');
          }
        } catch (e) {
          console.warn('[WakeLock] Wake lock request failed:', e);
        }
      }
    };

    const handleInteraction = () => {
      startSilentLoop();

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current
          .resume()
          .then(() => {
            console.log('[Audio] AudioContext resumed via user interaction');
          })
          .catch(() => {});
      }

      onAudioUnlockedRef.current?.();
      setNeedsAudioUnlock(false);
      requestWakeLock();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (silentAudioRef.current && silentAudioRef.current.paused) {
          silentAudioRef.current.play().catch(() => {});
        }
      } else {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
        onAudioUnlockedRef.current?.();
        requestWakeLock();
      }
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    requestWakeLock();

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch (e) {}
        wakeLockRef.current = null;
      }
    };
  }, [startSilentLoop]);

  // Complete cleanup on unmount
  const cleanupLocalAudio = useCallback(() => {
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    if (micMergerNodeRef.current) {
      try {
        micMergerNodeRef.current.disconnect();
      } catch (e) {}
      micMergerNodeRef.current = null;
    }
    if (micPreFilterNodeRef.current) {
      try {
        micPreFilterNodeRef.current.disconnect();
      } catch (e) {}
      micPreFilterNodeRef.current = null;
    }
    if (micPostFilterNodeRef.current) {
      try {
        micPostFilterNodeRef.current.disconnect();
      } catch (e) {}
      micPostFilterNodeRef.current = null;
    }
    if (micHighCutNodeRef.current) {
      try {
        micHighCutNodeRef.current.disconnect();
      } catch (e) {}
      micHighCutNodeRef.current = null;
    }
    if (micGateGainNodeRef.current) {
      try {
        micGateGainNodeRef.current.disconnect();
      } catch (e) {}
      micGateGainNodeRef.current = null;
    }
    if (micSourceNodeRef.current) {
      try {
        micSourceNodeRef.current.disconnect();
      } catch (e) {}
      micSourceNodeRef.current = null;
    }

    if (rawMicStreamRef.current) {
      rawMicStreamRef.current.getTracks().forEach((track) => track.stop());
      rawMicStreamRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (rnnoiseNodeRef.current) {
      try {
        rnnoiseNodeRef.current.destroy();
      } catch (e) {}
      rnnoiseNodeRef.current = null;
    }

    if (silentAudioRef.current) {
      try {
        silentAudioRef.current.pause();
        silentAudioRef.current.src = '';
        silentAudioRef.current.remove();
      } catch (e) {}
      silentAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupLocalAudio();
    };
  }, [cleanupLocalAudio]);

  return {
    isMuted,
    isMutedRef,
    isNoiseSuppression,
    isNoiseSuppressionRef,
    isNoiseSuppressionReady,
    needsAudioUnlock,
    setNeedsAudioUnlock,
    audioContextRef,
    analyserRef,
    streamRef,
    rawMicStreamRef,
    micGateGainNodeRef,
    getAudioContext,
    connectMicGraph,
    initLocalAudio,
    toggleMute,
    setMicrophoneMuted,
    toggleNoiseSuppression,
    unlockAudio,
    cleanupLocalAudio,
  };
}
