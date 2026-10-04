import { useState, useRef, useCallback, useEffect, type MutableRefObject } from 'react';
import type { ClientMessage, PeerInfo } from '../../types/protocol';

export interface UseVoiceActivityProps {
  audioContextRef: MutableRefObject<AudioContext | null>;
  analyserRef: MutableRefObject<AnalyserNode | null>;
  micGateGainNodeRef: MutableRefObject<GainNode | null>;
  streamRef: MutableRefObject<MediaStream | null>;
  isMutedRef: MutableRefObject<boolean>;
  isNoiseSuppressionRef: MutableRefObject<boolean>;
  peerConnectionsRef: MutableRefObject<Map<string, RTCPeerConnection>>;
  peersInfoRef: MutableRefObject<Map<string, PeerInfo>>;
  updatePeersState: () => void;
  sendWsMessageRef: MutableRefObject<(msg: ClientMessage) => void>;
}

export function useVoiceActivity({
  audioContextRef,
  analyserRef,
  micGateGainNodeRef,
  streamRef,
  isMutedRef,
  isNoiseSuppressionRef,
  peerConnectionsRef,
  peersInfoRef,
  updatePeersState,
  sendWsMessageRef,
}: UseVoiceActivityProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechHangoverRef = useRef<number>(0);
  const lastBroadcastSpeakingRef = useRef<number>(0);
  const remoteHangoverRef = useRef<Map<string, number>>(new Map());
  const remoteAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());

  const stopSpeaking = useCallback(() => {
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      sendWsMessageRef.current({ type: 'speaking', isSpeaking: false });
    }
  }, [sendWsMessageRef]);

  const removeRemotePeerActivity = useCallback((peerId: string) => {
    remoteHangoverRef.current.delete(peerId);
    const remoteAnalyser = remoteAnalysersRef.current.get(peerId);
    if (remoteAnalyser) {
      try {
        remoteAnalyser.disconnect();
      } catch (e) {}
      remoteAnalysersRef.current.delete(peerId);
    }
  }, []);

  const registerRemoteAnalyser = useCallback((peerId: string, analyser: AnalyserNode) => {
    const old = remoteAnalysersRef.current.get(peerId);
    if (old) {
      try {
        old.disconnect();
      } catch (e) {}
    }
    remoteAnalysersRef.current.set(peerId, analyser);
  }, []);

  const handleRemoteSpeaking = useCallback((peerId: string, speaking: boolean) => {
    const info = peersInfoRef.current.get(peerId);
    if (info) {
      if (speaking) {
        info.isSpeaking = true;
        remoteHangoverRef.current.set(peerId, Date.now() + 500);
      } else {
        info.isSpeaking = false;
        remoteHangoverRef.current.delete(peerId);
      }
      peersInfoRef.current.set(peerId, info);
      updatePeersState();
    }
  }, [peersInfoRef, updatePeersState]);

  const startVad = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    const analyser = analyserRef.current;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(128);
    const remoteDataArray = new Uint8Array(128);

    vadIntervalRef.current = setInterval(() => {
      const now = Date.now();
      let stateChanged = false;

      // Auto-resume suspended AudioContext
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }

      // 1. Local mic VAD and intelligent soft noise gate
      if (analyserRef.current && streamRef.current) {
        const track = streamRef.current.getAudioTracks()[0];
        const gateGain = micGateGainNodeRef.current;
        const audioCtx = audioContextRef.current;

        if (!track || !track.enabled) {
          if (gateGain && audioCtx && isNoiseSuppressionRef.current) {
            gateGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.01);
          }
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            sendWsMessageRef.current({ type: 'speaking', isSpeaking: false });
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

          // Sensitivity threshold: 5.0 out of 255 in speech range
          if (vocalAverage > 5.0) {
            speechHangoverRef.current = now + 400;

            // Open noise gate with fast attack (10ms)
            if (gateGain && audioCtx && isNoiseSuppressionRef.current) {
              gateGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.01);
            }

            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true;
              setIsSpeaking(true);
              sendWsMessageRef.current({ type: 'speaking', isSpeaking: true });
              lastBroadcastSpeakingRef.current = now;
            } else if (now - lastBroadcastSpeakingRef.current > 150) {
              // Keep-alive broadcast every 150ms while speaking
              sendWsMessageRef.current({ type: 'speaking', isSpeaking: true });
              lastBroadcastSpeakingRef.current = now;
            }
          } else if (isSpeakingRef.current && now > speechHangoverRef.current) {
            // Close noise gate with smooth exponential release (50ms, no clicks or pops)
            if (gateGain && audioCtx && isNoiseSuppressionRef.current) {
              gateGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.05);
            }
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            sendWsMessageRef.current({ type: 'speaking', isSpeaking: false });
          } else if (
            !isSpeakingRef.current &&
            now > speechHangoverRef.current &&
            gateGain &&
            audioCtx &&
            isNoiseSuppressionRef.current
          ) {
            // Keep noise gate closed during silence to eliminate fan and background noise
            gateGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.05);
          } else if (gateGain && audioCtx && !isNoiseSuppressionRef.current) {
            // Direct pass-through if user disabled noise suppression
            gateGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.01);
          }
        }
      }

      // 2. Remote peers VAD: autonomous local AnalyserNode + fallback to getSynchronizationSources
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
                if (
                  receiver.track &&
                  receiver.track.kind === 'audio' &&
                  typeof receiver.getSynchronizationSources === 'function'
                ) {
                  for (const src of receiver.getSynchronizationSources()) {
                    if (
                      (typeof src.audioLevel === 'number' && src.audioLevel > 0.01) ||
                      (src as any).voiceActivityFlag === true
                    ) {
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
  }, [
    audioContextRef,
    analyserRef,
    micGateGainNodeRef,
    streamRef,
    isNoiseSuppressionRef,
    peerConnectionsRef,
    peersInfoRef,
    updatePeersState,
    sendWsMessageRef,
  ]);

  const stopVad = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
  }, []);

  const clearVoiceActivity = useCallback(() => {
    stopVad();
    remoteHangoverRef.current.clear();
    remoteAnalysersRef.current.forEach((a) => {
      try {
        a.disconnect();
      } catch (e) {}
    });
    remoteAnalysersRef.current.clear();
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [stopVad]);

  useEffect(() => {
    return () => {
      clearVoiceActivity();
    };
  }, [clearVoiceActivity]);

  return {
    isSpeaking,
    isSpeakingRef,
    remoteAnalysersRef,
    remoteHangoverRef,
    startVad,
    stopVad,
    stopSpeaking,
    registerRemoteAnalyser,
    removeRemotePeerActivity,
    handleRemoteSpeaking,
    clearVoiceActivity,
  };
}
