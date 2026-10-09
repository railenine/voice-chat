import { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendBaseUrl } from '../config';
import {
  playDeafenSound,
  playUndeafenSound,
} from '../utils/soundEffects';

import type {
  PeerInfo,
  ChatMessage,
  WebRTCSignalData,
  RoomStateMessage,
  UserJoinedMessage,
  UserUpdatedMessage,
  UserMutedMessage,
  UserDeafenedMessage,
} from '../types/protocol';
import { useRoomChat } from './voice/useRoomChat';
import { useRoomParticipants } from './voice/useRoomParticipants';
import { useVoiceActivity } from './voice/useVoiceActivity';
import { useLocalAudio } from './voice/useLocalAudio';
import { useRemoteAudio } from './voice/useRemoteAudio';
import { usePeerConnections } from './voice/usePeerConnections';
import { useSignaling } from './voice/useSignaling';

export type { PeerInfo, ChatMessage };

interface UseVoiceChatOptions {
  roomId: string;
  nickname: string;
  audioInputDeviceId?: string;
  audioOutputDeviceId?: string;
}

export function useVoiceChat({
  roomId,
  nickname,
  audioInputDeviceId,
  audioOutputDeviceId,
}: UseVoiceChatOptions) {
  const [isDeafened, setIsDeafened] = useState(false);
  const isDeafenedRef = useRef(false);
  useEffect(() => {
    isDeafenedRef.current = isDeafened;
  }, [isDeafened]);

  const [myPeerId, setMyPeerId] = useState<string>('');
  const myPeerIdRef = useRef<string>('');
  const currentNicknameRef = useRef<string>(nickname);
  const audioInputDeviceIdRef = useRef<string | undefined>(audioInputDeviceId);
  useEffect(() => {
    audioInputDeviceIdRef.current = audioInputDeviceId;
  }, [audioInputDeviceId]);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const initDoneRef = useRef(false);
  const initRef = useRef<() => void>(() => {});
  const unlockAllRemoteAudioRef = useRef<() => void>(() => {});
  const markConnectedRef = useRef<() => void>(() => {});

  // 1. Room participants hook
  const {
    peers,
    peersInfoRef,
    syncPeersState: updatePeersState,
    clearParticipants,
    removeParticipant,
  } = useRoomParticipants();

  // 2. Local audio & microphone graph hook
  const {
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
    initLocalAudio,
    toggleMute: toggleLocalMute,
    setMicrophoneMuted,
    toggleNoiseSuppression,
    unlockAudio,
    cleanupLocalAudio,
  } = useLocalAudio({
    audioInputDeviceId,
    audioOutputDeviceId,
    peerConnectionsRef,
    onAudioUnlocked: () => unlockAllRemoteAudioRef.current(),
  });

  // 3. Remote peer audio elements & Web Audio mixer hook
  const isConnectedRefContainer = useRef(false);
  const {
    peerVolumes,
    setPeerVolumes,
    peerVolumesRef,
    getSavedVolume,
    setPeerVolume,
    teardownPeerAudioGraph,
    handleRemoteStream,
    cleanupRemotePeerAudio,
    applyDeafenToRemoteAudio,
    unlockAllRemoteAudio,
    clearAllRemoteAudio,
  } = useRemoteAudio({
    getAudioContext,
    peersInfoRef,
    isDeafenedRef,
    audioOutputDeviceId,
    registerRemoteAnalyser: (peerId, analyser) => {
      remoteAnalysersRef.current.set(peerId, analyser);
    },
    removeRemotePeerActivity: (peerId) => {
      removeRemotePeerActivity(peerId);
    },
    setNeedsAudioUnlock,
    markConnected: () => markConnectedRef.current(),
    isConnectedRef: isConnectedRefContainer,
  });

  unlockAllRemoteAudioRef.current = unlockAllRemoteAudio;

  // Stable forward refs for WebRTC callbacks
  const sendWsMessageProxyRef = useRef<(msg: any) => void>(() => {});

  // 4. Voice activity detection hook (local FFT + remote FFT)
  const {
    isSpeaking,
    remoteAnalysersRef,
    startVad,
    stopVad,
    stopSpeaking,
    removeRemotePeerActivity,
    handleRemoteSpeaking,
    clearVoiceActivity,
  } = useVoiceActivity({
    audioContextRef,
    analyserRef,
    micGateGainNodeRef,
    streamRef,
    isMutedRef,
    isNoiseSuppressionRef,
    peerConnectionsRef,
    peersInfoRef,
    updatePeersState,
    sendWsMessageRef: sendWsMessageProxyRef,
  });

  // 5. Peer connections hook (W3C Perfect Negotiation, Opus SDP, ICE restart, coordinated recovery)
  const {
    iceServersRef,
    getOrCreatePeerConnection,
    cleanupPeer,
    rebuildPeer,
    handleSignal,
    clearAllPeerConnections,
  } = usePeerConnections({
    myPeerIdRef,
    streamRef,
    sendWsMessage: (msg) => sendWsMessageProxyRef.current(msg),
    handleRemoteStream,
    teardownPeerAudioGraph,
    cleanupRemotePeerAudio,
    removeParticipant,
    markConnected: () => markConnectedRef.current(),
    isConnectedRef: isConnectedRefContainer,
    peerConnectionsRef,
  });

  // Signaling message handlers
  const onRoomState = useCallback(
    (msg: RoomStateMessage) => {
      if (Array.isArray(msg.iceServers) && msg.iceServers.length > 0) {
        iceServersRef.current = msg.iceServers;
        console.log(`[ICE] Updated ICE servers from room-state: ${msg.iceServers.length} servers`);
      }
      if (Array.isArray(msg.messages)) {
        setMessages(msg.messages);
      }
      const peerList = Array.isArray(msg.peers) ? msg.peers : [];
      if (peerList.length > 0) {
        const newVols: Record<string, number> = {};
        peerList.forEach((p: PeerInfo) => {
          peersInfoRef.current.set(p.peerId, p);
          const savedVol = getSavedVolume(p.peerId, p.nickname);
          peerVolumesRef.current.set(p.peerId, savedVol);
          newVols[p.peerId] = savedVol;

          const existingPc = peerConnectionsRef.current.get(p.peerId);
          if (
            existingPc &&
            existingPc.connectionState !== 'connected' &&
            existingPc.connectionState !== 'new'
          ) {
            console.log(
              `[WebRTC] Peer ${p.peerId} was in ${existingPc.connectionState}, rebuilding on room-state`
            );
            rebuildPeer(p.peerId, true);
          } else {
            getOrCreatePeerConnection(p.peerId);
          }
        });
        setPeerVolumes((prev) => ({ ...prev, ...newVols }));
        updatePeersState();
      }
    },
    [getSavedVolume, setPeerVolumes, updatePeersState, rebuildPeer, getOrCreatePeerConnection, iceServersRef, peersInfoRef, peerVolumesRef]
  );

  const onUserJoined = useCallback(
    (msg: UserJoinedMessage) => {
      if (Array.isArray(msg.iceServers) && msg.iceServers.length > 0) {
        iceServersRef.current = msg.iceServers;
      }
      if (msg.peer.nickname && msg.peer.nickname !== 'Аноним') {
        for (const [oldId, oldInfo] of peersInfoRef.current.entries()) {
          if (oldId !== msg.peer.peerId && oldInfo.nickname === msg.peer.nickname) {
            console.log(`[WebRTC] Removing duplicate old peer ${oldId} for ${msg.peer.nickname}`);
            cleanupPeer(oldId);
          }
        }
      }
      peersInfoRef.current.set(msg.peer.peerId, msg.peer);
      const savedVol = getSavedVolume(msg.peer.peerId, msg.peer.nickname);
      peerVolumesRef.current.set(msg.peer.peerId, savedVol);
      setPeerVolumes((prev) => ({ ...prev, [msg.peer.peerId]: savedVol }));

      const existingPc = peerConnectionsRef.current.get(msg.peer.peerId);
      if (
        existingPc &&
        existingPc.connectionState !== 'connected' &&
        existingPc.connectionState !== 'new'
      ) {
        console.log(
          `[WebRTC] Peer ${msg.peer.peerId} was in ${existingPc.connectionState}, rebuilding on user-joined`
        );
        rebuildPeer(msg.peer.peerId, true);
      } else {
        getOrCreatePeerConnection(msg.peer.peerId);
      }
      updatePeersState();
    },
    [cleanupPeer, getSavedVolume, setPeerVolumes, rebuildPeer, getOrCreatePeerConnection, updatePeersState, iceServersRef, peersInfoRef, peerVolumesRef]
  );

  const onSignal = useCallback(
    (from: string, data: WebRTCSignalData) => {
      handleSignal(from, data);
    },
    [handleSignal]
  );

  const onUserUpdated = useCallback(
    (msg: UserUpdatedMessage) => {
      const info = peersInfoRef.current.get(msg.peerId);
      if (info) {
        info.nickname = msg.nickname;
        peersInfoRef.current.set(msg.peerId, info);
        // Persist volume for the updated nickname, but NEVER overwrite the active peerId volume!
        const currentVol = peerVolumesRef.current.get(msg.peerId);
        if (currentVol !== undefined) {
          try {
            localStorage.setItem(`peer_volume_${msg.nickname}`, String(currentVol));
          } catch (e) {}
        }
        updatePeersState();
      }
    },
    [updatePeersState, peersInfoRef, peerVolumesRef]
  );

  const onUserMuted = useCallback(
    (msg: UserMutedMessage) => {
      const info = peersInfoRef.current.get(msg.peerId);
      if (info) {
        info.isMuted = msg.isMuted;
        peersInfoRef.current.set(msg.peerId, info);
        updatePeersState();
      }
    },
    [updatePeersState, peersInfoRef]
  );

  const onUserDeafened = useCallback(
    (msg: UserDeafenedMessage) => {
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
    },
    [updatePeersState, peersInfoRef]
  );

  const onUserSpeaking = useCallback(
    (peerId: string, isSpeakingVal: boolean) => {
      handleRemoteSpeaking(peerId, isSpeakingVal);
    },
    [handleRemoteSpeaking]
  );

  const onUserLeft = useCallback(
    (peerId: string) => {
      cleanupPeer(peerId);
    },
    [cleanupPeer]
  );

  const onChatMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    },
    []
  );

  const onWsDisconnectCleanup = useCallback(() => {
    const allPeerIds = Array.from(peerConnectionsRef.current.keys());
    for (const peerId of allPeerIds) {
      console.log(`[WebRTC] Cleaning up stale peer ${peerId} after WS disconnect`);
      cleanupPeer(peerId);
    }
  }, [cleanupPeer]);

  // 6. Signaling hook (WebSocket lifecycle, auto-reconnect backoff, message dispatch)
  const {
    isConnected,
    isConnectedRef,
    error,
    setError,
    connectionStatus,
    setConnectionStatus,
    reconnectAttempts,
    sendWsMessage,
    connectWs,
    disconnectWs,
    markConnected,
    resetSignaling,
  } = useSignaling({
    roomId,
    myPeerIdRef,
    currentNicknameRef,
    isMutedRef,
    isDeafenedRef,
    onRoomState,
    onUserJoined,
    onSignal,
    onUserUpdated,
    onUserMuted,
    onUserDeafened,
    onUserSpeaking,
    onUserLeft,
    onChatMessage,
    onWsDisconnectCleanup,
  });

  isConnectedRefContainer.current = isConnected;
  markConnectedRef.current = markConnected;
  sendWsMessageProxyRef.current = sendWsMessage;

  // 7. Room chat hook
  const {
    messages,
    setMessages,
    sendChatMessage,
    clearMessages,
  } = useRoomChat({ sendWsMessage });

  // Toggle microphone mute
  const toggleMute = useCallback(() => {
    toggleLocalMute((newMuted) => {
      if (newMuted) {
        stopSpeaking();
      }

      if (isDeafenedRef.current && !newMuted) {
        isDeafenedRef.current = false;
        setIsDeafened(false);
        sendWsMessage({ type: 'update-deafen', isDeafened: false });
        applyDeafenToRemoteAudio(false);
      }

      sendWsMessage({
        type: 'update-mute',
        isMuted: newMuted,
      });
    });
  }, [toggleLocalMute, stopSpeaking, sendWsMessage, applyDeafenToRemoteAudio]);

  // Toggle full deafen (mute mic + mute all incoming sound)
  const toggleDeafen = useCallback(() => {
    const nextDeafened = !isDeafenedRef.current;
    isDeafenedRef.current = nextDeafened;
    setIsDeafened(nextDeafened);

    if (nextDeafened) {
      setMicrophoneMuted(true);
      stopSpeaking();
      applyDeafenToRemoteAudio(true);
      sendWsMessage({ type: 'update-deafen', isDeafened: true });
      sendWsMessage({ type: 'update-mute', isMuted: true });
      playDeafenSound();
    } else {
      setMicrophoneMuted(false);
      applyDeafenToRemoteAudio(false);
      sendWsMessage({ type: 'update-deafen', isDeafened: false });
      sendWsMessage({ type: 'update-mute', isMuted: false });
      playUndeafenSound();
    }
  }, [setMicrophoneMuted, stopSpeaking, applyDeafenToRemoteAudio, sendWsMessage]);

  // Change nickname function exposed to UI
  const changeNickname = useCallback(
    (newNickname: string) => {
      const trimmed = newNickname.trim().substring(0, 32);
      if (!trimmed) return;

      currentNicknameRef.current = trimmed;
      sendWsMessage({
        type: 'update-nickname',
        nickname: trimmed,
      });
    },
    [sendWsMessage]
  );

  // MediaSession API integration (background hardware / OS mute toggle & playback control)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      if ('MediaMetadata' in window) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `RVxis — Комната ${roomId}`,
          artist: nickname,
          album: isMuted ? 'Микрофон выключен' : 'Микрофон включен',
        });
      }

      navigator.mediaSession.playbackState = 'playing';

      navigator.mediaSession.setActionHandler('togglemicrophone' as any, () => {
        toggleMute();
      });

      navigator.mediaSession.setActionHandler('play', () => {
        unlockAudio();
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
  }, [roomId, nickname, isMuted, toggleMute, unlockAudio, isMutedRef]);

  // Main room and media initialization effect
  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    let initialPeerId = '';
    try {
      initialPeerId = sessionStorage.getItem(`vc_peer_${roomId}`) || '';
    } catch (e) {}

    if (!initialPeerId) {
      initialPeerId = `vc-${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      try {
        sessionStorage.setItem(`vc_peer_${roomId}`, initialPeerId);
      } catch (e) {}
    }
    myPeerIdRef.current = initialPeerId;
    setMyPeerId(initialPeerId);

    const init = async () => {
      initRef.current = init;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(
            'Ваш браузер не поддерживает доступ к микрофону или страница открыта не по HTTPS.'
          );
        }

        // Pre-fetch ICE servers from backend
        try {
          const iceRes = await fetch(`${getBackendBaseUrl()}/peerjs/ice-servers`);
          if (iceRes.ok) {
            const iceData = await iceRes.json();
            if (Array.isArray(iceData?.iceServers) && iceData.iceServers.length > 0) {
              iceServersRef.current = iceData.iceServers;
              console.log(
                `[ICE] Pre-fetched ${iceData.iceServers.length} ICE servers (Coturn TURN ready)`
              );
            }
          }
        } catch (iceErr) {
          console.warn('[ICE] Pre-fetch failed, will use room-state or fallback:', iceErr);
        }

        setConnectionStatus('Запрос доступа к микрофону...');
        await initLocalAudio(audioInputDeviceIdRef.current);
        startVad();
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

    return () => {
      stopVad();
      disconnectWs();
      clearAllPeerConnections();
      clearAllRemoteAudio();
      cleanupLocalAudio();
      clearParticipants();
      clearMessages();
      clearVoiceActivity();
    };
  }, [
    roomId,
    clearAllPeerConnections,
    clearAllRemoteAudio,
    cleanupLocalAudio,
    clearParticipants,
    clearMessages,
    clearVoiceActivity,
    connectWs,
    disconnectWs,
    iceServersRef,
    initLocalAudio,
    setConnectionStatus,
    setError,
    startVad,
    stopVad,
  ]);

  const retryConnection = useCallback(() => {
    resetSignaling();

    if (!rawMicStreamRef.current) {
      console.log('[VoiceChat] Retrying full audio and room initialization...');
      initDoneRef.current = false;
      initRef.current();
    } else {
      console.log('[VoiceChat] Retrying WebSocket connection...');
      connectWs();
    }
  }, [resetSignaling, connectWs, rawMicStreamRef]);

  return {
    isConnected,
    isMuted,
    isDeafened,
    isSpeaking,
    peers,
    error,
    connectionStatus,
    reconnectAttempts,
    retryConnection,
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
