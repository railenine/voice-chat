import { useState, useEffect, useRef, useCallback } from 'react';
import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import { getBackendBaseUrl, getWebSocketUrl } from '../config';
import {
  playMuteSound,
  playUnmuteSound,
  playJoinSound,
  playLeaveSound,
  playDeafenSound,
  playUndeafenSound,
} from '../utils/soundEffects';

export interface PeerInfo {
  peerId: string;
  nickname: string;
  isMuted: boolean;
  isDeafened?: boolean;
  isSpeaking: boolean;
}

export interface ChatMessage {
  id: string;
  peerId: string;
  nickname: string;
  text: string;
  timestamp: number;
}

interface UseVoiceChatOptions {
  roomId: string;
  nickname: string;
  audioInputDeviceId?: string;
  audioOutputDeviceId?: string;
}

const isIOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
);

const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

// Optimize WebRTC Opus SDP: 32kbps mono with in-band FEC to halve bandwidth consumption while preserving speech clarity
function optimizeAudioSdp(sdp: string): string {
  const match = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (!match) return sdp;
  const pt = match[1];

  const fmtpRegex = new RegExp(`(a=fmtp:${pt}\\s+)([^\\r\\n]+)`, 'i');
  const customParams = 'maxaveragebitrate=32000;stereo=0;sprop-stereo=0;useinbandfec=1;cbr=0';

  if (fmtpRegex.test(sdp)) {
    return sdp.replace(fmtpRegex, (_m, prefix, params) => {
      const clean = params
        .replace(/maxaveragebitrate=\d+;?/gi, '')
        .replace(/stereo=[01];?/gi, '')
        .replace(/sprop-stereo=[01];?/gi, '')
        .replace(/useinbandfec=[01];?/gi, '')
        .replace(/cbr=[01];?/gi, '')
        .replace(/;\s*$/, '')
        .trim();
      const sep = clean.length > 0 && !clean.endsWith(';') ? ';' : '';
      return `${prefix}${clean}${sep}${customParams}`;
    });
  } else {
    return sdp.replace(
      new RegExp(`(a=rtpmap:${pt}\\s+opus\\/48000[^\\r\\n]*)`, 'i'),
      `$1\r\na=fmtp:${pt} ${customParams}`
    );
  }
}

export function useVoiceChat({
  roomId,
  nickname,
  audioInputDeviceId,
  audioOutputDeviceId,
}: UseVoiceChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  const [isDeafened, setIsDeafened] = useState(false);
  const isDeafenedRef = useRef(false);
  useEffect(() => {
    isDeafenedRef.current = isDeafened;
  }, [isDeafened]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Подключение...');
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [isNoiseSuppression, setIsNoiseSuppression] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('voice_chat_rnnoise');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });
  const [isNoiseSuppressionReady, setIsNoiseSuppressionReady] = useState(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const myPeerIdRef = useRef<string>('');
  const currentNicknameRef = useRef<string>(nickname);
  const rawMicStreamRef = useRef<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micPreFilterNodeRef = useRef<BiquadFilterNode | null>(null);
  const rnnoiseNodeRef = useRef<RnnoiseWorkletNode | null>(null);
  const micPostFilterNodeRef = useRef<BiquadFilterNode | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micMergerNodeRef = useRef<ChannelMergerNode | null>(null);
  const isNoiseSuppressionRef = useRef(isNoiseSuppression);
  const peersInfoRef = useRef<Map<string, PeerInfo>>(new Map());
  const peerVolumesRef = useRef<Map<string, number>>(new Map());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const peerMergerNodesRef = useRef<Map<string, ChannelMergerNode>>(new Map());
  const peerSourceNodesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());
  const peerCompressorNodesRef = useRef<Map<string, DynamicsCompressorNode>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isSettingRemoteAnswerPendingRef = useRef<Map<string, boolean>>(new Map());
  const failedRecoveryTimersRef = useRef<Map<string, any>>(new Map());
  const rebuildPeerRef = useRef<(peerId: string) => void>(() => {});
  const initDoneRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const isIntentionalDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<any>(null);
  const iceServersRef = useRef<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ]);

  // VAD refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef(false);
  const speechHangoverRef = useRef<number>(0);
  const lastBroadcastSpeakingRef = useRef<number>(0);
  const remoteHangoverRef = useRef<Map<string, number>>(new Map());
  const remoteAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const wakeLockRef = useRef<any>(null);

  const updatePeersState = useCallback(() => {
    setPeers(Array.from(peersInfoRef.current.values()));
  }, []);

  const sendWsMessage = useCallback((msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendWsMessage({
      type: 'chat-message',
      text: trimmed,
    });
  }, [sendWsMessage]);

  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

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
      silentAudioRef.current.play().then(() => {
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      }).catch(() => {});
    }
  }, []);

  // Unlock audio playback (AudioContext & <audio> elements)
  const unlockAudio = useCallback(() => {
    startSilentLoop();

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch((err) => console.warn('[Audio] Resume failed:', err));
    }

    const isWebAudioRunning = Boolean(!isIOS && audioContextRef.current && audioContextRef.current.state === 'running');

    audioElementsRef.current.forEach((audio, peerId) => {
      const pVol = peerVolumesRef.current.get(peerId) ?? 100;
      const pMuted = pVol === 0;
      audio.muted = isDeafenedRef.current ? true : (isWebAudioRunning ? true : pMuted);
      audio.volume = isWebAudioRunning ? 1.0 : Math.min(1.0, pVol / 100);
      audio.play().then(() => {
        console.log(`[Audio] Unlocked playback for ${peerId}`);
        setNeedsAudioUnlock(false);
      }).catch((err) => {
        console.warn(`[Audio] Play failed for ${peerId}:`, err);
      });
    });
  }, [startSilentLoop]);

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
        audioContextRef.current.resume().then(() => {
          console.log('[Audio] AudioContext resumed via user interaction');
        }).catch(() => {});
      }
      const isWebAudioRunning = Boolean(!isIOS && audioContextRef.current && audioContextRef.current.state === 'running');
      audioElementsRef.current.forEach((audio, peerId) => {
        const pVol = peerVolumesRef.current.get(peerId) ?? 100;
        const pMuted = pVol === 0;
        audio.muted = isDeafenedRef.current ? true : (isWebAudioRunning ? true : pMuted);
        audio.volume = isWebAudioRunning ? 1.0 : Math.min(1.0, pVol / 100);
        if (audio.paused) {
          audio.play().then(() => {
            setNeedsAudioUnlock(false);
          }).catch(() => {});
        }
      });
      requestWakeLock();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App sent to background or screen locked: ensure silent audio loop keeps audio session alive
        if (silentAudioRef.current && silentAudioRef.current.paused) {
          silentAudioRef.current.play().catch(() => {});
        }
      } else {
        // App returned to foreground: resume AudioContext and reacquire wake lock
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
        audioElementsRef.current.forEach((audio) => {
          if (audio.paused) {
            audio.play().catch(() => {});
          }
        });
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

  // Helper to ensure AudioContext is initialized and active
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
        if (audioOutputDeviceId && typeof (audioContextRef.current as any).setSinkId === 'function') {
          (audioContextRef.current as any).setSinkId(audioOutputDeviceId).catch(() => {});
        }
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, [audioOutputDeviceId]);

  // Helper to read saved volume by nickname from localStorage
  const getSavedVolume = useCallback((nick: string): number => {
    try {
      const saved = localStorage.getItem(`peer_volume_${nick}`);
      if (saved !== null) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 0 && val <= 200) {
          return val;
        }
      }
    } catch (e) {}
    return 100;
  }, []);

  // Set volume for a remote peer (0 to 200%) - supports volume boost across all platforms
  const setPeerVolume = useCallback((peerId: string, volume: number) => {
    const clamped = Math.max(0, Math.min(200, Math.round(volume)));
    peerVolumesRef.current.set(peerId, clamped);
    setPeerVolumes((prev) => ({ ...prev, [peerId]: clamped }));

    const isMuted = clamped === 0;

    // 1. Web Audio GainNode (controls volume & boost up to 200%)
    const gainNode = gainNodesRef.current.get(peerId);
    if (gainNode) {
      gainNode.gain.value = clamped / 100;
    }

    // 2. Hardware/track level mute (works 100% on iOS Safari & instant silencing)
    const stream = remoteStreamsRef.current.get(peerId);
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }

    // 3. Audio element (kept muted ONLY when Web Audio ctx.destination is active and running on non-iOS)
    const audio = audioElementsRef.current.get(peerId);
    if (audio) {
      const isWebAudioRunning = Boolean(!isIOS && gainNode && audioContextRef.current && audioContextRef.current.state === 'running');
      if (isWebAudioRunning) {
        audio.muted = isDeafenedRef.current ? true : false;
      } else {
        audio.muted = isDeafenedRef.current ? true : isMuted;
        audio.volume = Math.min(1.0, clamped / 100);
      }
    }

    const peerInfo = peersInfoRef.current.get(peerId);
    if (peerInfo?.nickname) {
      try {
        localStorage.setItem(`peer_volume_${peerInfo.nickname}`, String(clamped));
      } catch (e) {}
    }
  }, []);

  // Handle incoming remote audio stream
  const handleRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    console.log(`[Audio] Received remote audio stream for peer: ${peerId}`);
    remoteStreamsRef.current.set(peerId, stream);

    const currentVol = peerVolumesRef.current.get(peerId) ?? 100;
    const isMuted = currentVol === 0;

    // Track-level mute (essential for instant silencing & iOS Safari)
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });

    // Setup Web Audio GainNode for volume control and boost (0% to 200%)
    const ctx = getAudioContext();
    let gainNode = gainNodesRef.current.get(peerId);

    if (ctx && !gainNode) {
      try {
        const source = ctx.createMediaStreamSource(stream);
        peerSourceNodesRef.current.set(peerId, source);

        // Explicitly upmix to stereo (both Left and Right channels) to prevent single-ear playback in Firefox
        const merger = ctx.createChannelMerger(2);
        source.connect(merger, 0, 0); // Left ear
        source.connect(merger, 0, 1); // Right ear
        peerMergerNodesRef.current.set(peerId, merger);

        gainNode = ctx.createGain();
        gainNode.gain.value = currentVol / 100;
        merger.connect(gainNode);

        // Dynamics compressor limiter to prevent clipping when boosted above 100%
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -6;
        compressor.knee.value = 10;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.15;
        gainNode.connect(compressor);
        peerCompressorNodesRef.current.set(peerId, compressor);

        // Remote AnalyserNode for autonomous, browser-agnostic local VAD (Firefox, Safari, Chrome, iOS, Android)
        const remoteAnalyser = ctx.createAnalyser();
        remoteAnalyser.fftSize = 256;
        remoteAnalyser.smoothingTimeConstant = 0.3;
        merger.connect(remoteAnalyser);
        remoteAnalysersRef.current.set(peerId, remoteAnalyser);

        // On non-iOS (Desktop, Android, etc.): connect directly to system audio output for up to 200% boost.
        // On iOS Safari: WebKit cannot output remote WebRTC streams via ctx.destination.
        // Remote audio MUST play exclusively through HTML <audio> element.
        if (!isIOS) {
          compressor.connect(ctx.destination);
          gainNodesRef.current.set(peerId, gainNode);
          console.log(`[Audio] Web Audio GainNode & Limiter connected directly to output for peer ${peerId} (up to 200% boost)`);
        } else {
          gainNodesRef.current.set(peerId, gainNode);
          console.log(`[Audio] iOS detected: remote audio for ${peerId} will play exclusively via <audio> element`);
        }

        // Dynamically sync all peer audio elements whenever AudioContext state transitions (suspended <-> running)
        if (!ctx.onstatechange) {
          ctx.onstatechange = () => {
            const isRunning = ctx.state === 'running';
            console.log(`[Audio] AudioContext state changed: ${ctx.state}`);
            audioElementsRef.current.forEach((audioEl, pId) => {
              const pVol = peerVolumesRef.current.get(pId) ?? 100;
              const pMuted = pVol === 0;
              // On iOS, never mute <audio> just because Web Audio is running!
              audioEl.muted = isDeafenedRef.current ? true : (!isIOS && isRunning ? true : pMuted);
              audioEl.volume = !isIOS && isRunning ? 1.0 : Math.min(1.0, pVol / 100);
            });
          };
        }
      } catch (err) {
        console.warn(`[Audio] Could not create Web Audio graph for ${peerId}, falling back to direct <audio>:`, err);
      }
    } else if (gainNode) {
      gainNode.gain.value = isDeafenedRef.current ? 0 : currentVol / 100;
    }

    const isWebAudioRunning = Boolean(!isIOS && gainNode && ctx && ctx.state === 'running');

    let audio = audioElementsRef.current.get(peerId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      (audio as any).playsInline = true;
      (audio as any).webkitPlaysInline = true;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.setAttribute('autoplay', 'true');
      // If Web Audio is active AND running (non-iOS only), mute <audio> to prevent double playback / echo.
      // On iOS, keep <audio> UNMUTED always!
      audio.muted = isDeafenedRef.current ? true : (isWebAudioRunning ? true : isMuted);
      audio.volume = isWebAudioRunning ? 1.0 : Math.min(1.0, currentVol / 100);
      // Position off-screen so the browser keeps it in the render tree (never use display: none)
      audio.style.position = 'fixed';
      audio.style.top = '-9999px';
      audio.style.left = '-9999px';
      audio.style.width = '1px';
      audio.style.height = '1px';
      audio.style.opacity = '0.01';
      document.body.appendChild(audio);
      audioElementsRef.current.set(peerId, audio);

      if (audioOutputDeviceId && typeof (audio as any).setSinkId === 'function') {
        (audio as any).setSinkId(audioOutputDeviceId).catch((err: any) => {
          console.warn(`[Audio] Failed to set sinkId on peer ${peerId}:`, err);
        });
      }
    } else {
      audio.muted = isDeafenedRef.current ? true : (isWebAudioRunning ? true : isMuted);
      audio.volume = isWebAudioRunning ? 1.0 : Math.min(1.0, currentVol / 100);

      if (audioOutputDeviceId && typeof (audio as any).setSinkId === 'function') {
        (audio as any).setSinkId(audioOutputDeviceId).catch((err: any) => {
          console.warn(`[Audio] Failed to update sinkId on peer ${peerId}:`, err);
        });
      }
    }

    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }

    const playAudio = () => {
      if (!audio) return;
      audio.play().then(() => {
        console.log(`[Audio] Playing remote audio for peer ${peerId}`);
        setNeedsAudioUnlock(false);
      }).catch((err) => {
        console.warn(`[Audio] Autoplay blocked for peer ${peerId}:`, err);
        setNeedsAudioUnlock(true);
      });
    };

    playAudio();

    stream.getAudioTracks().forEach((track) => {
      track.onunmute = () => {
        console.log(`[Audio] Track unmuted for peer: ${peerId}`);
        playAudio();
      };
    });
  }, [getAudioContext, audioOutputDeviceId]);

  // Cleanup a peer connection and audio
  const cleanupPeer = useCallback((peerId: string) => {
    console.log(`[WebRTC] Cleaning up peer: ${peerId}`);
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      peerConnectionsRef.current.delete(peerId);
    }

    makingOfferRef.current.delete(peerId);
    ignoreOfferRef.current.delete(peerId);
    remoteHangoverRef.current.delete(peerId);

    const remoteAnalyser = remoteAnalysersRef.current.get(peerId);
    if (remoteAnalyser) {
      try { remoteAnalyser.disconnect(); } catch (e) {}
      remoteAnalysersRef.current.delete(peerId);
    }

    const gainNode = gainNodesRef.current.get(peerId);
    if (gainNode) {
      try { gainNode.disconnect(); } catch (e) {}
      gainNodesRef.current.delete(peerId);
    }
    const compressor = peerCompressorNodesRef.current.get(peerId);
    if (compressor) {
      try { compressor.disconnect(); } catch (e) {}
      peerCompressorNodesRef.current.delete(peerId);
    }
    const merger = peerMergerNodesRef.current.get(peerId);
    if (merger) {
      try { merger.disconnect(); } catch (e) {}
      peerMergerNodesRef.current.delete(peerId);
    }
    const source = peerSourceNodesRef.current.get(peerId);
    if (source) {
      try { source.disconnect(); } catch (e) {}
      peerSourceNodesRef.current.delete(peerId);
    }
    remoteStreamsRef.current.delete(peerId);

    const timer = failedRecoveryTimersRef.current.get(peerId);
    if (timer) {
      clearTimeout(timer);
      failedRecoveryTimersRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
    isSettingRemoteAnswerPendingRef.current.delete(peerId);

    const audio = audioElementsRef.current.get(peerId);
    if (audio) {
      try {
        audio.srcObject = null;
        audio.remove();
      } catch (e) {}
      audioElementsRef.current.delete(peerId);
    }

    peersInfoRef.current.delete(peerId);
    peerVolumesRef.current.delete(peerId);
    setPeerVolumes((prev) => {
      if (!(peerId in prev)) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
    updatePeersState();
  }, [updatePeersState]);

  // Create or get RTCPeerConnection with W3C Perfect Negotiation pattern
  const getOrCreatePeerConnection = useCallback((remotePeerId: string): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(remotePeerId);
    if (pc) return pc;

    console.log(`[WebRTC] Creating RTCPeerConnection for: ${remotePeerId}`);
    pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peerConnectionsRef.current.set(remotePeerId, pc);

    // Polite peer determination (symmetric & deterministic)
    const polite = myPeerIdRef.current > remotePeerId;

    // Add local microphone tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        pc!.addTrack(track, streamRef.current!);
      });
    }

    // Perfect Negotiation: onnegotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.set(remotePeerId, true);
        await pc!.setLocalDescription();
        const sdp = pc!.localDescription?.sdp ? optimizeAudioSdp(pc!.localDescription.sdp) : undefined;
        sendWsMessage({
          type: 'signal',
          to: remotePeerId,
          data: {
            description: pc!.localDescription
              ? { type: pc!.localDescription.type, sdp }
              : undefined,
          },
        });
      } catch (err) {
        console.error(`[WebRTC] Negotiation error with ${remotePeerId}:`, err);
      } finally {
        makingOfferRef.current.set(remotePeerId, false);
      }
    };

    // ICE Candidate exchange
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendWsMessage({
          type: 'signal',
          to: remotePeerId,
          data: { candidate },
        });
      }
    };

    // Receive remote tracks
    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack event from ${remotePeerId}`);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      handleRemoteStream(remotePeerId, remoteStream);
    };

    // Connection & ICE state monitoring with automatic recovery for long sessions
    const checkStateAndRecover = () => {
      const connState = pc!.connectionState;
      const iceState = pc!.iceConnectionState;
      console.log(`[WebRTC] Peer ${remotePeerId} state: conn=${connState}, ice=${iceState}`);

      if (connState === 'failed' || iceState === 'failed') {
        try {
          pc!.restartIce();
        } catch (e) {}

        if (!failedRecoveryTimersRef.current.has(remotePeerId)) {
          const timer = setTimeout(() => {
            failedRecoveryTimersRef.current.delete(remotePeerId);
            const currentPc = peerConnectionsRef.current.get(remotePeerId);
            if (
              currentPc &&
              (currentPc.connectionState === 'failed' ||
                currentPc.iceConnectionState === 'failed' ||
                currentPc.connectionState === 'disconnected')
            ) {
              console.log(`[WebRTC] Auto-rebuilding failed connection for ${remotePeerId}...`);
              rebuildPeerRef.current(remotePeerId);
            }
          }, 3500);
          failedRecoveryTimersRef.current.set(remotePeerId, timer);
        }
      } else if (connState === 'connected' || iceState === 'connected') {
        const timer = failedRecoveryTimersRef.current.get(remotePeerId);
        if (timer) {
          clearTimeout(timer);
          failedRecoveryTimersRef.current.delete(remotePeerId);
        }
      }
    };

    pc.onconnectionstatechange = checkStateAndRecover;
    pc.oniceconnectionstatechange = checkStateAndRecover;

    return pc;
  }, [sendWsMessage, handleRemoteStream]);

  // Rebuild an unrecoverable peer connection
  const rebuildPeer = useCallback((remotePeerId: string) => {
    console.log(`[WebRTC] Rebuilding peer connection for ${remotePeerId}`);
    const oldPc = peerConnectionsRef.current.get(remotePeerId);
    if (oldPc) {
      try { oldPc.close(); } catch (e) {}
      peerConnectionsRef.current.delete(remotePeerId);
    }
    makingOfferRef.current.delete(remotePeerId);
    ignoreOfferRef.current.delete(remotePeerId);
    isSettingRemoteAnswerPendingRef.current.delete(remotePeerId);
    pendingCandidatesRef.current.delete(remotePeerId);

    const newPc = getOrCreatePeerConnection(remotePeerId);
    if (newPc && newPc.onnegotiationneeded) {
      newPc.onnegotiationneeded(new Event('negotiationneeded'));
    }
  }, [getOrCreatePeerConnection]);

  rebuildPeerRef.current = rebuildPeer;

  // Handle incoming signaling message (W3C Perfect Negotiation)
  const handleSignal = useCallback(async (from: string, data: any) => {
    const pc = getOrCreatePeerConnection(from);
    const polite = myPeerIdRef.current > from;

    try {
      if (data.description) {
        const description = data.description;
        const isMakingOffer = makingOfferRef.current.get(from) || false;
        const isSettingRemoteAnswerPending = isSettingRemoteAnswerPendingRef.current.get(from) || false;

        const readyForOffer = !isMakingOffer &&
          (pc.signalingState === 'stable' || isSettingRemoteAnswerPending);
        const offerCollision = (description.type === 'offer') && !readyForOffer;

        const ignoreOffer = !polite && offerCollision;
        ignoreOfferRef.current.set(from, ignoreOffer);

        if (ignoreOffer) {
          console.log(`[WebRTC] Collision detected with ${from} (impolite peer ignores offer)`);
          return;
        }

        if (offerCollision && polite) {
          console.log(`[WebRTC] Collision detected with ${from} (polite peer rolls back local offer)`);
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch (e) {
            console.warn('[WebRTC] Rollback error:', e);
          }
        }

        if (description.type === 'answer') {
          isSettingRemoteAnswerPendingRef.current.set(from, true);
        }

        try {
          await pc.setRemoteDescription(description);
        } finally {
          isSettingRemoteAnswerPendingRef.current.set(from, false);
        }

        // Process any queued ICE candidates that arrived before setRemoteDescription
        const queue = pendingCandidatesRef.current.get(from);
        if (queue && queue.length > 0) {
          console.log(`[WebRTC] Flushing ${queue.length} queued ICE candidates for ${from}`);
          pendingCandidatesRef.current.delete(from);
          for (const cand of queue) {
            try {
              await pc.addIceCandidate(cand);
            } catch (err) {
              console.warn(`[WebRTC] Error adding queued ICE candidate for ${from}:`, err);
            }
          }
        }

        if (description.type === 'offer') {
          await pc.setLocalDescription();
          const sdp = pc.localDescription?.sdp ? optimizeAudioSdp(pc.localDescription.sdp) : undefined;
          sendWsMessage({
            type: 'signal',
            to: from,
            data: {
              description: pc.localDescription
                ? { type: pc.localDescription.type, sdp }
                : undefined,
            },
          });
        }
      } else if (data.candidate) {
        // Queue candidate if remote description is not set yet
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
          let queue = pendingCandidatesRef.current.get(from);
          if (!queue) {
            queue = [];
            pendingCandidatesRef.current.set(from, queue);
          }
          queue.push(data.candidate);
          console.log(`[WebRTC] Queued early ICE candidate for ${from} (total: ${queue.length})`);
        } else {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (err) {
            if (!ignoreOfferRef.current.get(from)) {
              console.warn(`[WebRTC] Error adding ICE candidate from ${from}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error(`[WebRTC] Error handling signal from ${from}:`, err);
    }
  }, [getOrCreatePeerConnection, sendWsMessage]);

  // Change nickname function exposed to UI
  const changeNickname = useCallback((newNickname: string) => {
    const trimmed = newNickname.trim().substring(0, 32);
    if (!trimmed) return;

    currentNicknameRef.current = trimmed;
    sendWsMessage({
      type: 'update-nickname',
      nickname: trimmed,
    });
  }, [sendWsMessage]);

  // Connect/reconnect mic audio graph based on isNoiseSuppression
  const connectMicGraph = useCallback(() => {
    const micSource = micSourceNodeRef.current;
    const rnnoiseNode = rnnoiseNodeRef.current;
    const mediaStreamDest = mediaStreamDestRef.current;
    const analyser = analyserRef.current;

    if (!micSource || !mediaStreamDest) return;

    try { micSource.disconnect(); } catch (e) {}
    if (micPreFilterNodeRef.current) {
      try { micPreFilterNodeRef.current.disconnect(); } catch (e) {}
    }
    if (rnnoiseNode) {
      try { rnnoiseNode.disconnect(); } catch (e) {}
    }
    if (micPostFilterNodeRef.current) {
      try { micPostFilterNodeRef.current.disconnect(); } catch (e) {}
    }
    if (micMergerNodeRef.current) {
      try { micMergerNodeRef.current.disconnect(); } catch (e) {}
    }

    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    if (!micMergerNodeRef.current) {
      micMergerNodeRef.current = audioCtx.createChannelMerger(2);
    }
    const micMerger = micMergerNodeRef.current;

    if (isNoiseSuppressionRef.current && rnnoiseNode) {
      // 1. Pre-filter: High-Pass at 80Hz (Q: 0.7) to eliminate desk rumble, wind/breath, and 50/60Hz mains hum
      if (!micPreFilterNodeRef.current) {
        const preFilter = audioCtx.createBiquadFilter();
        preFilter.type = 'highpass';
        preFilter.frequency.value = 80;
        preFilter.Q.value = 0.7;
        micPreFilterNodeRef.current = preFilter;
      }
      const preFilter = micPreFilterNodeRef.current;

      // 2. Post-filter: High-Shelf at 5500Hz (+2.0dB) to restore presence and vocal brilliance after RNNoise Bark-scale filtering
      if (!micPostFilterNodeRef.current) {
        const postFilter = audioCtx.createBiquadFilter();
        postFilter.type = 'highshelf';
        postFilter.frequency.value = 5500;
        postFilter.gain.value = 2.0;
        micPostFilterNodeRef.current = postFilter;
      }
      const postFilter = micPostFilterNodeRef.current;

      // Chain: micSource -> preFilter -> rnnoiseNode -> postFilter -> micMerger -> mediaStreamDest
      micSource.connect(preFilter);
      preFilter.connect(rnnoiseNode);
      rnnoiseNode.connect(postFilter);
      postFilter.connect(micMerger, 0, 0);
      postFilter.connect(micMerger, 0, 1);
      micMerger.connect(mediaStreamDest);

      if (analyser) {
        postFilter.connect(analyser);
      }
      console.log('[RNNoise] Enhanced filter chain active (High-Pass 80Hz + RNNoise + Post-EQ)');
    } else {
      // Noise suppression bypassed: direct pass-through
      micSource.connect(micMerger, 0, 0);
      micSource.connect(micMerger, 0, 1);
      micMerger.connect(mediaStreamDest);

      if (analyser) {
        micSource.connect(analyser);
      }
      console.log('[RNNoise] Filter bypassed (direct pass-through)');
    }
  }, []);

  const toggleNoiseSuppression = useCallback(() => {
    const next = !isNoiseSuppressionRef.current;
    isNoiseSuppressionRef.current = next;
    setIsNoiseSuppression(next);
    try {
      localStorage.setItem('voice_chat_rnnoise', String(next));
    } catch (e) {}
    connectMicGraph();
  }, [connectMicGraph]);

  // Toggle microphone mute
  const toggleMute = useCallback(() => {
    const newMuted = !isMutedRef.current;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);

    if (newMuted) {
      playMuteSound();
    } else {
      playUnmuteSound();
    }

    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted;
      });
    }
    if (rawMicStreamRef.current) {
      rawMicStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted;
      });
    }

    if (newMuted && isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      sendWsMessage({ type: 'speaking', isSpeaking: false });
    }

    // If user was deafened and un-mutes mic, undeafen as well
    if (isDeafenedRef.current && !newMuted) {
      isDeafenedRef.current = false;
      setIsDeafened(false);
      sendWsMessage({ type: 'update-deafen', isDeafened: false });

      const ctx = audioContextRef.current;
      const isWebAudioRunning = Boolean(!isIOS && ctx && ctx.state === 'running');
      audioElementsRef.current.forEach((audio, peerId) => {
        const pVol = peerVolumesRef.current.get(peerId) ?? 100;
        audio.muted = isWebAudioRunning ? true : pVol === 0;
        audio.volume = isWebAudioRunning ? 1.0 : Math.min(1.0, pVol / 100);
      });
      gainNodesRef.current.forEach((gn, peerId) => {
        const pVol = peerVolumesRef.current.get(peerId) ?? 100;
        gn.gain.value = pVol / 100;
      });
    }

    sendWsMessage({
      type: 'update-mute',
      isMuted: newMuted,
    });
  }, [sendWsMessage]);

  // Toggle full deafen (mute mic + mute all incoming sound)
  const toggleDeafen = useCallback(() => {
    const nextDeafened = !isDeafenedRef.current;
    isDeafenedRef.current = nextDeafened;
    setIsDeafened(nextDeafened);

    if (nextDeafened) {
      // Deafen ON: Mute local microphone
      isMutedRef.current = true;
      setIsMuted(true);

      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      if (rawMicStreamRef.current) {
        rawMicStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        sendWsMessage({ type: 'speaking', isSpeaking: false });
      }

      // Mute all incoming audio
      audioElementsRef.current.forEach((audio) => {
        audio.muted = true;
      });
      gainNodesRef.current.forEach((gn) => {
        gn.gain.value = 0;
      });

      sendWsMessage({ type: 'update-deafen', isDeafened: true });
      sendWsMessage({ type: 'update-mute', isMuted: true });
      playDeafenSound();
    } else {
      // Deafen OFF: Unmute local microphone
      isMutedRef.current = false;
      setIsMuted(false);

      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
      }
      if (rawMicStreamRef.current) {
        rawMicStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
      }

      // Restore incoming audio
      const ctx = audioContextRef.current;
      const isWebAudioRunning = Boolean(!isIOS && ctx && ctx.state === 'running');
      audioElementsRef.current.forEach((audio, peerId) => {
        const pVol = peerVolumesRef.current.get(peerId) ?? 100;
        audio.muted = isWebAudioRunning ? true : pVol === 0;
        audio.volume = isWebAudioRunning ? 1.0 : Math.min(1.0, pVol / 100);
      });
      gainNodesRef.current.forEach((gn, peerId) => {
        const pVol = peerVolumesRef.current.get(peerId) ?? 100;
        gn.gain.value = pVol / 100;
      });

      sendWsMessage({ type: 'update-deafen', isDeafened: false });
      sendWsMessage({ type: 'update-mute', isMuted: false });
      playUndeafenSound();
    }
  }, [sendWsMessage]);

  // MediaSession API integration (background hardware / OS mute toggle & playback control)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      if ('MediaMetadata' in window) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `VoiceChat — Комната ${roomId}`,
          artist: nickname,
          album: isMuted ? 'Микрофон выключен' : 'Микрофон включен',
        });
      }

      navigator.mediaSession.playbackState = 'playing';

      navigator.mediaSession.setActionHandler('togglemicrophone' as any, () => {
        toggleMute();
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (silentAudioRef.current && silentAudioRef.current.paused) {
          silentAudioRef.current.play().catch(() => {});
        }
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
        if (isMutedRef.current) {
          toggleMute();
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (!isMutedRef.current) {
          toggleMute();
        }
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        if (!isMutedRef.current) {
          toggleMute();
        }
      });
    } catch (e) {
      console.warn('[MediaSession] Action handlers not supported:', e);
    }

    return () => {
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.setActionHandler('togglemicrophone' as any, null);
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('stop', null);
        } catch (e) {}
      }
    };
  }, [roomId, nickname, isMuted, toggleMute]);

  // Update output sink for all peer audio elements and AudioContext when audioOutputDeviceId changes
  useEffect(() => {
    if (!audioOutputDeviceId) return;
    audioElementsRef.current.forEach((audio, peerId) => {
      if (typeof (audio as any).setSinkId === 'function') {
        (audio as any).setSinkId(audioOutputDeviceId).catch((err: any) => {
          console.warn(`[Audio] Failed to set sinkId on peer ${peerId}:`, err);
        });
      }
    });
    if (audioContextRef.current && typeof (audioContextRef.current as any).setSinkId === 'function') {
      (audioContextRef.current as any).setSinkId(audioOutputDeviceId).catch((err: any) => {
        console.warn('[Audio] Failed to set sinkId on AudioContext:', err);
      });
    }
  }, [audioOutputDeviceId]);

  // Switch microphone input device dynamically if user changes it during call
  const prevInputDeviceRef = useRef<string | undefined>(audioInputDeviceId);
  useEffect(() => {
    if (!initDoneRef.current || !rawMicStreamRef.current) return;
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
                noiseSuppression: false,
                autoGainControl: true,
              }
            : {
                echoCancellation: true,
                noiseSuppression: false,
                autoGainControl: true,
              },
        };
        const newRawStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newRawTrack = newRawStream.getAudioTracks()[0];
        if (!newRawTrack) return;

        if (rawMicStreamRef.current) {
          rawMicStreamRef.current.getAudioTracks().forEach((t) => t.stop());
        }
        rawMicStreamRef.current = newRawStream;
        newRawTrack.enabled = !isMuted;

        connectMicGraph();

        const activeTrack = streamRef.current?.getAudioTracks()[0] || newRawTrack;
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
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
  }, [audioInputDeviceId, isMuted, connectMicGraph]);

  // Main initialization effect
  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    let myPeerId = '';
    try {
      myPeerId = sessionStorage.getItem(`vc_peer_${roomId}`) || '';
    } catch (e) {}

    if (!myPeerId) {
      myPeerId = `vc-${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      try {
        sessionStorage.setItem(`vc_peer_${roomId}`, myPeerId);
      } catch (e) {}
    }
    myPeerIdRef.current = myPeerId;
    setMyPeerId(myPeerId);

    const init = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Ваш браузер не поддерживает доступ к микрофону или страница открыта не по HTTPS.');
        }

        // Pre-fetch ICE servers from backend
        try {
          const iceRes = await fetch(`${getBackendBaseUrl()}/peerjs/ice-servers`);
          if (iceRes.ok) {
            const iceData = await iceRes.json();
            if (Array.isArray(iceData?.iceServers) && iceData.iceServers.length > 0) {
              iceServersRef.current = iceData.iceServers;
              console.log(`[ICE] Pre-fetched ${iceData.iceServers.length} ICE servers (Coturn TURN ready)`);
            }
          }
        } catch (iceErr) {
          console.warn('[ICE] Pre-fetch failed, will use room-state or fallback:', iceErr);
        }

        setConnectionStatus('Запрос доступа к микрофону...');
        let rawStream: MediaStream;
        const micConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: false, // Using RNNoise for neural noise suppression
          autoGainControl: true,
        };
        if (audioInputDeviceId) {
          micConstraints.deviceId = { exact: audioInputDeviceId };
        }
        try {
          rawStream = await navigator.mediaDevices.getUserMedia({
            audio: micConstraints,
          });
        } catch (firstErr) {
          console.warn('Advanced/device audio constraints failed, falling back to basic audio: true', firstErr);
          rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        const rawAudioTrack = rawStream.getAudioTracks()[0];
        if (!rawAudioTrack) {
          throw new Error('Микрофон не вернул аудиодорожку.');
        }
        rawAudioTrack.enabled = true;
        rawMicStreamRef.current = rawStream;

        // Setup Web Audio API and RNNoise Worklet
        try {
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

            // Attempt loading RNNoise WASM + Worklet
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

            // Connect audio graph
            connectMicGraph();

            // Outbound stream for WebRTC
            streamRef.current = mediaStreamDest.stream;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            vadIntervalRef.current = setInterval(() => {
              const now = Date.now();
              let stateChanged = false;

              // Auto-resume suspended AudioContext
              if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().catch(() => {});
              }

              // 1. Local mic VAD (visual indicator only, never mutes audio stream)
              if (analyserRef.current && streamRef.current) {
                const track = streamRef.current.getAudioTracks()[0];
                if (!track || !track.enabled) {
                  if (isSpeakingRef.current) {
                    isSpeakingRef.current = false;
                    setIsSpeaking(false);
                    sendWsMessage({ type: 'speaking', isSpeaking: false });
                  }
                } else {
                  analyserRef.current.getByteFrequencyData(dataArray);
                  // Analyze vocal frequency bins 1 to 32 (~150Hz to ~6000Hz)
                  let sum = 0;
                  const vocalBins = Math.min(32, dataArray.length);
                  for (let i = 1; i < vocalBins; i++) {
                    sum += dataArray[i];
                  }
                  const vocalAverage = sum / (vocalBins - 1);

                  // Sensitivity threshold: 6 out of 255 in speech range
                  if (vocalAverage > 6) {
                    speechHangoverRef.current = now + 400;
                    if (!isSpeakingRef.current) {
                      isSpeakingRef.current = true;
                      setIsSpeaking(true);
                      sendWsMessage({ type: 'speaking', isSpeaking: true });
                      lastBroadcastSpeakingRef.current = now;
                    } else if (now - lastBroadcastSpeakingRef.current > 150) {
                      // Keep-alive broadcast every 150ms while speaking
                      sendWsMessage({ type: 'speaking', isSpeaking: true });
                      lastBroadcastSpeakingRef.current = now;
                    }
                  } else if (isSpeakingRef.current && now > speechHangoverRef.current) {
                    isSpeakingRef.current = false;
                    setIsSpeaking(false);
                    sendWsMessage({ type: 'speaking', isSpeaking: false });
                  }
                }
              }

              // 2. Remote peers VAD: autonomous local AnalyserNode + fallback to getSynchronizationSources
              const remoteDataArray = new Uint8Array(128);
              peerConnectionsRef.current.forEach((pc, remotePeerId) => {
                const peerInfo = peersInfoRef.current.get(remotePeerId);
                if (!peerInfo) return;

                let audioDetected = false;

                // Primary: Local Web Audio AnalyserNode (works 100% on Firefox, Safari, Chrome, iOS, Android)
                const remoteAnalyser = remoteAnalysersRef.current.get(remotePeerId);
                if (remoteAnalyser) {
                  remoteAnalyser.getByteFrequencyData(remoteDataArray);
                  let sum = 0;
                  const vocalBins = Math.min(32, remoteAnalyser.frequencyBinCount);
                  for (let i = 1; i < vocalBins; i++) {
                    sum += remoteDataArray[i];
                  }
                  const vocalAverage = sum / (vocalBins - 1);
                  if (vocalAverage > 6) {
                    audioDetected = true;
                  }
                }

                // Secondary Fallback: native WebRTC getSynchronizationSources
                if (!audioDetected) {
                  try {
                    if (pc && typeof pc.getReceivers === 'function') {
                      for (const receiver of pc.getReceivers()) {
                        if (receiver.track && receiver.track.kind === 'audio' && typeof receiver.getSynchronizationSources === 'function') {
                          for (const src of receiver.getSynchronizationSources()) {
                            if ((typeof src.audioLevel === 'number' && src.audioLevel > 0.01) || (src as any).voiceActivityFlag === true) {
                              audioDetected = true;
                              break;
                            }
                          }
                        }
                        if (audioDetected) break;
                      }
                    }
                  } catch (e) {}
                }

                if (audioDetected) {
                  remoteHangoverRef.current.set(remotePeerId, now + 400);
                  if (!peerInfo.isSpeaking) {
                    peerInfo.isSpeaking = true;
                    peersInfoRef.current.set(remotePeerId, peerInfo);
                    stateChanged = true;
                  }
                } else {
                  const hangover = remoteHangoverRef.current.get(remotePeerId) || 0;
                  if (peerInfo.isSpeaking && now > hangover) {
                    peerInfo.isSpeaking = false;
                    peersInfoRef.current.set(remotePeerId, peerInfo);
                    stateChanged = true;
                  }
                }
              });

              if (stateChanged) {
                updatePeersState();
              }
            }, 60);
          }
        } catch (vadErr) {
          console.warn('[VAD] Init failed:', vadErr);
        }

        // Connect to WebSocket signaling server with auto-reconnect and join/leave sounds
        const connectWs = () => {
          if (isIntentionalDisconnectRef.current) return;

          setConnectionStatus(wasConnectedRef.current ? 'Переподключение...' : 'Подключение к серверу...');
          const wsUrl = getWebSocketUrl();

          console.log(`[WS] Connecting to: ${wsUrl}`);
          try {
            if (wsRef.current) {
              try {
                wsRef.current.onclose = null;
                wsRef.current.close();
              } catch (e) {}
            }

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
              console.log('[WS] Connected successfully');
              setIsConnected(true);
              setConnectionStatus('В комнате ✓');

              // Join room message
              ws.send(JSON.stringify({
                type: 'join',
                roomId,
                peerId: myPeerIdRef.current,
                nickname: currentNicknameRef.current,
              }));
            };

            ws.onmessage = (event) => {
              let msg: any;
              try {
                msg = JSON.parse(event.data);
              } catch (e) {
                return;
              }

              const { type } = msg;

              // Initial room state: list of existing peers
              if (type === 'room-state') {
                console.log(`[WS] Received room-state with ${msg.peers?.length || 0} peers`);
                playJoinSound();
                wasConnectedRef.current = true;

                if (Array.isArray(msg.iceServers) && msg.iceServers.length > 0) {
                  iceServersRef.current = msg.iceServers;
                  console.log(`[ICE] Updated ICE servers from room-state: ${msg.iceServers.length} servers`);
                }
                if (Array.isArray(msg.messages)) {
                  setMessages(msg.messages);
                }
                if (Array.isArray(msg.peers)) {
                  const newVols: Record<string, number> = {};
                  msg.peers.forEach((p: PeerInfo) => {
                    peersInfoRef.current.set(p.peerId, p);
                    const savedVol = getSavedVolume(p.nickname);
                    peerVolumesRef.current.set(p.peerId, savedVol);
                    newVols[p.peerId] = savedVol;
                    // Create PeerConnection for existing peer (triggers negotiation)
                    getOrCreatePeerConnection(p.peerId);
                  });
                  setPeerVolumes((prev) => ({ ...prev, ...newVols }));
                  updatePeersState();
                }
              }

              // Another peer joined the room
              else if (type === 'user-joined') {
                console.log(`[WS] Peer joined: ${msg.peer.peerId} (${msg.peer.nickname})`);
                playJoinSound();
                if (Array.isArray(msg.iceServers) && msg.iceServers.length > 0) {
                  iceServersRef.current = msg.iceServers;
                }

                // If a peer with this nickname already exists under an old peerId, clean it up immediately
                if (msg.peer.nickname && msg.peer.nickname !== 'Аноним') {
                  for (const [oldId, oldInfo] of peersInfoRef.current.entries()) {
                    if (oldId !== msg.peer.peerId && oldInfo.nickname === msg.peer.nickname) {
                      console.log(`[WebRTC] Removing duplicate old peer ${oldId} for ${msg.peer.nickname}`);
                      cleanupPeer(oldId);
                    }
                  }
                }

                peersInfoRef.current.set(msg.peer.peerId, msg.peer);
                const savedVol = getSavedVolume(msg.peer.nickname);
                peerVolumesRef.current.set(msg.peer.peerId, savedVol);
                setPeerVolumes((prev) => ({ ...prev, [msg.peer.peerId]: savedVol }));
                getOrCreatePeerConnection(msg.peer.peerId);
                updatePeersState();
              }

              // WebRTC signaling message
              else if (type === 'signal') {
                handleSignal(msg.from, msg.data);
              }

              // Peer updated nickname
              else if (type === 'user-updated') {
                const info = peersInfoRef.current.get(msg.peerId);
                if (info) {
                  info.nickname = msg.nickname;
                  peersInfoRef.current.set(msg.peerId, info);
                  const savedVol = getSavedVolume(msg.nickname);
                  setPeerVolume(msg.peerId, savedVol);
                  updatePeersState();
                }
              }

              // Peer updated mute status
              else if (type === 'user-muted') {
                const info = peersInfoRef.current.get(msg.peerId);
                if (info) {
                  info.isMuted = msg.isMuted;
                  peersInfoRef.current.set(msg.peerId, info);
                  updatePeersState();
                }
              }

              // Peer updated deafen status
              else if (type === 'user-deafened') {
                const info = peersInfoRef.current.get(msg.peerId);
                if (info) {
                  info.isDeafened = msg.isDeafened;
                  if (msg.isDeafened) {
                    info.isMuted = true;
                    info.isSpeaking = false;
                  }
                  peersInfoRef.current.set(msg.peerId, info);
                  updatePeersState();
                }
              }

              // Peer speaking status
              else if (type === 'user-speaking') {
                const info = peersInfoRef.current.get(msg.peerId);
                if (info) {
                  if (msg.isSpeaking) {
                    info.isSpeaking = true;
                    remoteHangoverRef.current.set(msg.peerId, Date.now() + 500);
                  } else {
                    info.isSpeaking = false;
                    remoteHangoverRef.current.delete(msg.peerId);
                  }
                  peersInfoRef.current.set(msg.peerId, info);
                  updatePeersState();
                }
              }

              // Peer left the room
              else if (type === 'user-left') {
                console.log(`[WS] Peer left: ${msg.peerId}`);
                playLeaveSound();
                cleanupPeer(msg.peerId);
              }

              // In-room chat message
              else if (type === 'chat-message' && msg.message) {
                setMessages((prev) => [...prev, msg.message]);
              }
            };

            ws.onclose = () => {
              console.warn('[WS] WebSocket disconnected');
              setIsConnected(false);
              if (wasConnectedRef.current) {
                wasConnectedRef.current = false;
                playLeaveSound();
              }
              if (!isIntentionalDisconnectRef.current) {
                setConnectionStatus('Переподключение...');
                if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = setTimeout(() => {
                  if (!isIntentionalDisconnectRef.current) {
                    console.log('[WS] Reconnecting WebSocket...');
                    connectWs();
                  }
                }, 2000);
              }
            };

            ws.onerror = (err) => {
              console.error('[WS] WebSocket error:', err);
              setError('Ошибка подключения к серверу сигнализации.');
            };
          } catch (wsErr) {
            console.warn('[WS] Failed to connect:', wsErr);
            if (!isIntentionalDisconnectRef.current) {
              setConnectionStatus('Переподключение...');
              if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = setTimeout(connectWs, 2500);
            }
          }
        };

        connectWs();

      } catch (err: any) {
        console.error('Init error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('Микрофон не найден. Подключите микрофон и попробуйте снова.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Не удалось получить доступ к микрофону. Возможно, он используется другим приложением.');
        } else {
          setError(`Ошибка доступа к микрофону: ${err.message || 'Неизвестная ошибка'}`);
        }
      }
    };

    init();

    // User gesture listeners to unlock audio
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      isIntentionalDisconnectRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);

      // Stop VAD
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) {}
        audioContextRef.current = null;
      }

      // Close WebSocket
      if (wsRef.current) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'leave' }));
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }

      // Close all PeerConnections
      peerConnectionsRef.current.forEach((pc) => {
        try { pc.close(); } catch (e) {}
      });
      peerConnectionsRef.current.clear();
      makingOfferRef.current.clear();
      ignoreOfferRef.current.clear();
      failedRecoveryTimersRef.current.forEach((t) => clearTimeout(t));
      failedRecoveryTimersRef.current.clear();
      pendingCandidatesRef.current.clear();
      isSettingRemoteAnswerPendingRef.current.clear();

      // Remove all audio elements and gain nodes
      audioElementsRef.current.forEach((audio) => {
        try {
          audio.srcObject = null;
          audio.remove();
        } catch (e) {}
      });
      audioElementsRef.current.clear();

      gainNodesRef.current.forEach((gn) => {
        try { gn.disconnect(); } catch (e) {}
      });
      gainNodesRef.current.clear();
      peerCompressorNodesRef.current.forEach((c) => {
        try { c.disconnect(); } catch (e) {}
      });
      peerCompressorNodesRef.current.clear();
      peerMergerNodesRef.current.forEach((m) => {
        try { m.disconnect(); } catch (e) {}
      });
      peerMergerNodesRef.current.clear();
      peerSourceNodesRef.current.forEach((s) => {
        try { s.disconnect(); } catch (e) {}
      });
      peerSourceNodesRef.current.clear();
      remoteAnalysersRef.current.forEach((a) => {
        try { a.disconnect(); } catch (e) {}
      });
      remoteAnalysersRef.current.clear();
      remoteHangoverRef.current.clear();
      if (micMergerNodeRef.current) {
        try { micMergerNodeRef.current.disconnect(); } catch (e) {}
        micMergerNodeRef.current = null;
      }
      if (micPreFilterNodeRef.current) {
        try { micPreFilterNodeRef.current.disconnect(); } catch (e) {}
        micPreFilterNodeRef.current = null;
      }
      if (micPostFilterNodeRef.current) {
        try { micPostFilterNodeRef.current.disconnect(); } catch (e) {}
        micPostFilterNodeRef.current = null;
      }
      remoteStreamsRef.current.clear();

      // Stop local microphone stream
      if (rawMicStreamRef.current) {
        rawMicStreamRef.current.getTracks().forEach((track) => track.stop());
        rawMicStreamRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (rnnoiseNodeRef.current) {
        try { rnnoiseNodeRef.current.destroy(); } catch (e) {}
        rnnoiseNodeRef.current = null;
      }

      peersInfoRef.current.clear();
      remoteHangoverRef.current.clear();
      remoteAnalysersRef.current.forEach((a) => {
        try { a.disconnect(); } catch (e) {}
      });
      remoteAnalysersRef.current.clear();
      if (silentAudioRef.current) {
        try {
          silentAudioRef.current.pause();
          silentAudioRef.current.src = '';
          silentAudioRef.current.remove();
        } catch (e) {}
        silentAudioRef.current = null;
      }
    };
  }, [roomId, unlockAudio, getOrCreatePeerConnection, handleSignal, cleanupPeer, updatePeersState, sendWsMessage]);

  return {
    isConnected,
    isMuted,
    isDeafened,
    isSpeaking,
    peers,
    error,
    connectionStatus,
    needsAudioUnlock,
    unlockAudio,
    toggleMute,
    toggleDeafen,
    changeNickname,
    peerVolumes,
    setPeerVolume,
    isNoiseSuppression,
    isNoiseSuppressionReady,
    toggleNoiseSuppression,
    messages,
    sendChatMessage,
    myPeerId,
  };
}
