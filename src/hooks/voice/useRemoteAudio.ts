import { useState, useRef, useCallback, useEffect, type MutableRefObject } from 'react';
import type { PeerInfo } from '../../types/protocol';
import { getSavedPeerVolume, savePeerVolume, clampVolume } from '../../utils/volumePolicy';

const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export interface UseRemoteAudioProps {
  getAudioContext: () => AudioContext | null;
  peersInfoRef: MutableRefObject<Map<string, PeerInfo>>;
  isDeafenedRef: MutableRefObject<boolean>;
  audioOutputDeviceId?: string;
  registerRemoteAnalyser: (peerId: string, analyser: AnalyserNode) => void;
  removeRemotePeerActivity: (peerId: string) => void;
  setNeedsAudioUnlock: (needs: boolean) => void;
  markConnected: () => void;
  isConnectedRef: MutableRefObject<boolean>;
}

export function useRemoteAudio({
  getAudioContext,
  peersInfoRef,
  isDeafenedRef,
  audioOutputDeviceId,
  registerRemoteAnalyser,
  removeRemotePeerActivity,
  setNeedsAudioUnlock,
  markConnected,
  isConnectedRef,
}: UseRemoteAudioProps) {
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const peerVolumesRef = useRef<Map<string, number>>(new Map());

  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const peerMergerNodesRef = useRef<Map<string, ChannelMergerNode>>(new Map());
  const peerSourceNodesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());
  const peerCompressorNodesRef = useRef<Map<string, DynamicsCompressorNode>>(new Map());
  const peerProcessedDestNodesRef = useRef<Map<string, MediaStreamAudioDestinationNode>>(new Map());
  const peerPrimerAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  const audioOutputDeviceIdRef = useRef(audioOutputDeviceId);
  audioOutputDeviceIdRef.current = audioOutputDeviceId;

  // Read saved volume for a peer from localStorage (checks peerId first, then optional nickname fallback)
  const getSavedVolume = useCallback((peerId: string, nick?: string): number => {
    return getSavedPeerVolume(typeof localStorage !== 'undefined' ? localStorage : null, peerId, nick);
  }, []);

  // Set volume for a remote peer (0 to 200%)
  const setPeerVolume = useCallback(
    (peerId: string, volume: number) => {
      const clamped = Math.max(0, Math.min(200, Math.round(volume)));
      peerVolumesRef.current.set(peerId, clamped);
      setPeerVolumes((prev) => ({ ...prev, [peerId]: clamped }));

      const isMuted = clamped === 0;

      // 1. Hardware/track level mute (essential for iOS Safari & instant silencing)
      const stream = remoteStreamsRef.current.get(peerId);
      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });
      }

      // 2. Web Audio GainNode (provides full 0% to 200% volume for non-iOS)
      const gainNode = gainNodesRef.current.get(peerId);
      if (gainNode) {
        gainNode.gain.value = isDeafenedRef.current ? 0 : clamped / 100;
      }

      // 3. Audio element
      const audio = audioElementsRef.current.get(peerId);
      if (audio) {
        const hasProcessedStream = !isIOS && Boolean(peerProcessedDestNodesRef.current.get(peerId));
        audio.muted = isDeafenedRef.current ? true : isMuted;
        audio.volume = hasProcessedStream ? 1.0 : (isDeafenedRef.current ? 0 : Math.min(1.0, clamped / 100));
      }

      try {
        const peerInfo = peersInfoRef.current.get(peerId);
        savePeerVolume(
          typeof localStorage !== 'undefined' ? localStorage : null,
          peerId,
          clamped,
          peerInfo?.nickname
        );
      } catch (e) {}
    },
    [peersInfoRef, isDeafenedRef]
  );

  // Teardown Web Audio graph nodes for a peer (without removing DOM elements or volume state)
  const teardownPeerAudioGraph = useCallback(
    (peerId: string) => {
      const oldSource = peerSourceNodesRef.current.get(peerId);
      if (oldSource) {
        try {
          oldSource.disconnect();
        } catch (e) {}
        peerSourceNodesRef.current.delete(peerId);
      }
      const oldMerger = peerMergerNodesRef.current.get(peerId);
      if (oldMerger) {
        try {
          oldMerger.disconnect();
        } catch (e) {}
        peerMergerNodesRef.current.delete(peerId);
      }
      const oldGain = gainNodesRef.current.get(peerId);
      if (oldGain) {
        try {
          oldGain.disconnect();
        } catch (e) {}
        gainNodesRef.current.delete(peerId);
      }
      const oldComp = peerCompressorNodesRef.current.get(peerId);
      if (oldComp) {
        try {
          oldComp.disconnect();
        } catch (e) {}
        peerCompressorNodesRef.current.delete(peerId);
      }
      const oldProcessedDest = peerProcessedDestNodesRef.current.get(peerId);
      if (oldProcessedDest) {
        try {
          oldProcessedDest.disconnect();
        } catch (e) {}
        peerProcessedDestNodesRef.current.delete(peerId);
      }
      removeRemotePeerActivity(peerId);
    },
    [removeRemotePeerActivity]
  );

  // Handle incoming remote audio stream
  const handleRemoteStream = useCallback(
    (peerId: string, stream: MediaStream) => {
      console.log(`[Audio] Received remote audio stream for peer: ${peerId}`);
      const prevStream = remoteStreamsRef.current.get(peerId);
      const prevTrack = prevStream?.getAudioTracks()[0];
      const newTrack = stream.getAudioTracks()[0];
      const trackChanged = !prevTrack || prevTrack.id !== newTrack?.id || prevTrack.readyState === 'ended';

      if (prevStream && (prevStream.id !== stream.id || trackChanged)) {
        console.log(`[Audio] Stream/track changed for peer: ${peerId}, cleaning previous audio graph`);
        teardownPeerAudioGraph(peerId);
      }
      remoteStreamsRef.current.set(peerId, stream);

      // Prime the remote WebRTC stream with a dedicated muted audio element to prevent Chromium
      // from suspending/idling the underlying WebRTC decoder (Chromium Issue 687574 / 933677)
      if (!isIOS) {
        let primerAudio = peerPrimerAudioRef.current.get(peerId);
        if (!primerAudio) {
          primerAudio = document.createElement('audio');
          primerAudio.muted = true;
          primerAudio.autoplay = true;
          (primerAudio as any).playsInline = true;
          primerAudio.style.position = 'fixed';
          primerAudio.style.top = '-9999px';
          primerAudio.style.left = '-9999px';
          primerAudio.style.width = '1px';
          primerAudio.style.height = '1px';
          primerAudio.style.opacity = '0.01';
          document.body.appendChild(primerAudio);
          peerPrimerAudioRef.current.set(peerId, primerAudio);
        }
        if (primerAudio.srcObject !== stream) {
          primerAudio.srcObject = stream;
        }
        if (primerAudio.paused) {
          primerAudio.play().catch(() => {});
        }
      }

      const currentVol = peerVolumesRef.current.get(peerId) ?? 100;
      const isMuted = currentVol === 0;

      // Track-level mute (essential for instant silencing & iOS Safari)
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted && !isDeafenedRef.current;
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
          gainNode.gain.value = isDeafenedRef.current ? 0 : currentVol / 100;
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
          registerRemoteAnalyser(peerId, remoteAnalyser);

          // Single-sink audio routing:
          // Web Audio graph outputs exclusively to MediaStreamAudioDestinationNode (never to ctx.destination).
          if (!isIOS) {
            const processedDest = ctx.createMediaStreamDestination();
            compressor.connect(processedDest);
            peerProcessedDestNodesRef.current.set(peerId, processedDest);
            gainNodesRef.current.set(peerId, gainNode);
            console.log(`[Audio] Single-sink Web Audio pipeline active for peer ${peerId} (0-200% volume via processedDest)`);
          } else {
            gainNodesRef.current.set(peerId, gainNode);
            console.log(`[Audio] iOS detected: remote audio for ${peerId} will play exclusively via direct <audio> stream`);
          }

          if (!ctx.onstatechange) {
            ctx.onstatechange = () => {
              console.log(`[Audio] AudioContext state changed: ${ctx.state}`);
            };
          }
        } catch (err) {
          console.warn(`[Audio] Could not create Web Audio graph for ${peerId}, falling back to direct <audio>:`, err);
        }
      } else if (gainNode) {
        gainNode.gain.value = isDeafenedRef.current ? 0 : currentVol / 100;
      }

      const hasProcessedStream = !isIOS && Boolean(peerProcessedDestNodesRef.current.get(peerId));
      const targetStream = hasProcessedStream
        ? peerProcessedDestNodesRef.current.get(peerId)!.stream
        : stream;

      const sinkId = audioOutputDeviceIdRef.current || '';

      let audio = audioElementsRef.current.get(peerId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        (audio as any).playsInline = true;
        (audio as any).webkitPlaysInline = true;
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        audio.setAttribute('autoplay', 'true');
        audio.muted = isDeafenedRef.current ? true : isMuted;
        audio.volume = hasProcessedStream ? 1.0 : (isDeafenedRef.current ? 0 : Math.min(1.0, currentVol / 100));
        // Position off-screen so the browser keeps it in the render tree (never use display: none)
        audio.style.position = 'fixed';
        audio.style.top = '-9999px';
        audio.style.left = '-9999px';
        audio.style.width = '1px';
        audio.style.height = '1px';
        audio.style.opacity = '0.01';
        document.body.appendChild(audio);
        audioElementsRef.current.set(peerId, audio);

        if (typeof (audio as any).setSinkId === 'function') {
          (audio as any).setSinkId(sinkId).catch((err: any) => {
            console.warn(`[Audio] Failed to set sinkId on peer ${peerId}:`, err);
          });
        }
      } else {
        audio.muted = isDeafenedRef.current ? true : isMuted;
        audio.volume = hasProcessedStream ? 1.0 : (isDeafenedRef.current ? 0 : Math.min(1.0, currentVol / 100));

        if (typeof (audio as any).setSinkId === 'function') {
          (audio as any).setSinkId(sinkId).catch((err: any) => {
            console.warn(`[Audio] Failed to update sinkId on peer ${peerId}:`, err);
          });
        }
      }

      if (audio.srcObject !== targetStream) {
        audio.srcObject = targetStream;
      }

      const playAudio = () => {
        if (!audio) return;
        audio
          .play()
          .then(() => {
            console.log(`[Audio] Playing remote audio for peer ${peerId}`);
            setNeedsAudioUnlock(false);
          })
          .catch((err) => {
            if (err?.name === 'AbortError') return;
            console.warn(`[Audio] Autoplay blocked for peer ${peerId}:`, err);
            setNeedsAudioUnlock(true);
          });
      };

      playAudio();

      if (!isConnectedRef.current) {
        console.log(`[Audio] Received audio track from peer ${peerId}, completing reconnection`);
        markConnected();
      }

      stream.getAudioTracks().forEach((track) => {
        track.onunmute = () => {
          console.log(`[Audio] Track unmuted for peer: ${peerId}`);
          const activeCtx = getAudioContext();
          if (activeCtx && activeCtx.state === 'suspended') {
            activeCtx.resume().catch(() => {});
          }
          playAudio();
        };
      });
    },
    [
      getAudioContext,
      teardownPeerAudioGraph,
      isDeafenedRef,
      registerRemoteAnalyser,
      setNeedsAudioUnlock,
      markConnected,
      isConnectedRef,
    ]
  );

  // Complete cleanup of a single remote peer's audio
  const cleanupRemotePeerAudio = useCallback(
    (peerId: string) => {
      teardownPeerAudioGraph(peerId);

      const primer = peerPrimerAudioRef.current.get(peerId);
      if (primer) {
        try {
          primer.srcObject = null;
          primer.remove();
        } catch (e) {}
        peerPrimerAudioRef.current.delete(peerId);
      }

      const audio = audioElementsRef.current.get(peerId);
      if (audio) {
        try {
          audio.srcObject = null;
          audio.remove();
        } catch (e) {}
        audioElementsRef.current.delete(peerId);
      }

      remoteStreamsRef.current.delete(peerId);
      peerVolumesRef.current.delete(peerId);
      setPeerVolumes((prev) => {
        if (!(peerId in prev)) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    },
    [teardownPeerAudioGraph]
  );

  // Apply deafen state across all peers
  const applyDeafenToRemoteAudio = useCallback((isDeafened: boolean) => {
    audioElementsRef.current.forEach((audio, peerId) => {
      const pVol = peerVolumesRef.current.get(peerId) ?? 100;
      const hasProcessedStream = !isIOS && Boolean(peerProcessedDestNodesRef.current.get(peerId));
      audio.muted = isDeafened ? true : pVol === 0;
      audio.volume = hasProcessedStream ? 1.0 : (isDeafened ? 0 : Math.min(1.0, pVol / 100));
    });
    gainNodesRef.current.forEach((gn, peerId) => {
      const pVol = peerVolumesRef.current.get(peerId) ?? 100;
      gn.gain.value = isDeafened ? 0 : pVol / 100;
    });
    remoteStreamsRef.current.forEach((stream, peerId) => {
      const pVol = peerVolumesRef.current.get(peerId) ?? 100;
      const isMuted = pVol === 0;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isDeafened && !isMuted;
      });
    });
  }, []);

  // Unlock all peer audio elements
  const unlockAllRemoteAudio = useCallback(() => {
    audioElementsRef.current.forEach((audio, peerId) => {
      const pVol = peerVolumesRef.current.get(peerId) ?? 100;
      const pMuted = pVol === 0;
      const hasProcessedStream = !isIOS && Boolean(peerProcessedDestNodesRef.current.get(peerId));
      audio.muted = isDeafenedRef.current ? true : pMuted;
      audio.volume = hasProcessedStream ? 1.0 : (isDeafenedRef.current ? 0 : Math.min(1.0, pVol / 100));
      audio
        .play()
        .then(() => {
          console.log(`[Audio] Unlocked playback for ${peerId}`);
          setNeedsAudioUnlock(false);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          console.warn(`[Audio] Play failed for ${peerId}:`, err);
        });
    });
  }, [isDeafenedRef, setNeedsAudioUnlock]);

  // Complete cleanup on unmount
  const clearAllRemoteAudio = useCallback(() => {
    audioElementsRef.current.forEach((audio) => {
      try {
        audio.srcObject = null;
        audio.pause();
        audio.remove();
      } catch (e) {}
    });
    audioElementsRef.current.clear();

    peerPrimerAudioRef.current.forEach((primer) => {
      try {
        primer.srcObject = null;
        primer.pause();
        primer.remove();
      } catch (e) {}
    });
    peerPrimerAudioRef.current.clear();

    gainNodesRef.current.forEach((g) => {
      try {
        g.disconnect();
      } catch (e) {}
    });
    gainNodesRef.current.clear();

    peerCompressorNodesRef.current.forEach((c) => {
      try {
        c.disconnect();
      } catch (e) {}
    });
    peerCompressorNodesRef.current.clear();

    peerProcessedDestNodesRef.current.forEach((d) => {
      try {
        d.disconnect();
      } catch (e) {}
    });
    peerProcessedDestNodesRef.current.clear();

    peerMergerNodesRef.current.forEach((m) => {
      try {
        m.disconnect();
      } catch (e) {}
    });
    peerMergerNodesRef.current.clear();

    peerSourceNodesRef.current.forEach((s) => {
      try {
        s.disconnect();
      } catch (e) {}
    });
    peerSourceNodesRef.current.clear();

    remoteStreamsRef.current.clear();
    peerVolumesRef.current.clear();
    setPeerVolumes({});
  }, []);

  // Update output sink for all peer audio elements when audioOutputDeviceId changes
  useEffect(() => {
    const sinkId = audioOutputDeviceId || '';
    audioOutputDeviceIdRef.current = sinkId;
    audioElementsRef.current.forEach((audio, peerId) => {
      if (typeof (audio as any).setSinkId === 'function') {
        (audio as any).setSinkId(sinkId).catch((err: any) => {
          console.warn(`[Audio] Failed to set sinkId on peer ${peerId}:`, err);
        });
      }
    });
  }, [audioOutputDeviceId]);

  useEffect(() => {
    return () => {
      clearAllRemoteAudio();
    };
  }, [clearAllRemoteAudio]);

  return {
    peerVolumes,
    setPeerVolumes,
    peerVolumesRef,
    audioElementsRef,
    gainNodesRef,
    peerMergerNodesRef,
    peerSourceNodesRef,
    peerCompressorNodesRef,
    peerProcessedDestNodesRef,
    peerPrimerAudioRef,
    remoteStreamsRef,
    getSavedVolume,
    setPeerVolume,
    teardownPeerAudioGraph,
    handleRemoteStream,
    cleanupRemotePeerAudio,
    applyDeafenToRemoteAudio,
    unlockAllRemoteAudio,
    clearAllRemoteAudio,
  };
}
