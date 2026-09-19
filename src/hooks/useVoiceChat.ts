import { useState, useEffect, useRef, useCallback } from 'react';

export interface PeerInfo {
  peerId: string;
  nickname: string;
  isMuted: boolean;
  isSpeaking: boolean;
}

interface UseVoiceChatOptions {
  roomId: string;
  nickname: string;
}

export function useVoiceChat({ roomId, nickname }: UseVoiceChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Подключение...');
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const myPeerIdRef = useRef<string>('');
  const currentNicknameRef = useRef<string>(nickname);
  const streamRef = useRef<MediaStream | null>(null);
  const peersInfoRef = useRef<Map<string, PeerInfo>>(new Map());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const initDoneRef = useRef(false);

  // VAD refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef(false);
  const speechHangoverRef = useRef<number>(0);
  const lastBroadcastSpeakingRef = useRef<number>(0);
  const remoteHangoverRef = useRef<Map<string, number>>(new Map());

  // ICE configuration
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ];

  const updatePeersState = useCallback(() => {
    setPeers(Array.from(peersInfoRef.current.values()));
  }, []);

  const sendWsMessage = useCallback((msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Unlock audio playback (AudioContext & <audio> elements)
  const unlockAudio = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch((err) => console.warn('[Audio] Resume failed:', err));
    }

    let allPlaying = true;
    audioElementsRef.current.forEach((audio, peerId) => {
      if (audio.paused) {
        audio.play().then(() => {
          console.log(`[Audio] Unlocked playback for ${peerId}`);
        }).catch((err) => {
          console.warn(`[Audio] Play failed for ${peerId}:`, err);
          allPlaying = false;
        });
      }
    });

    if (allPlaying) {
      setNeedsAudioUnlock(false);
    }
  }, []);

  // Handle incoming remote audio stream
  const handleRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    console.log(`[Audio] Received remote audio stream for peer: ${peerId}`);
    let audio = audioElementsRef.current.get(peerId);

    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      (audio as any).playsInline = true;
      (audio as any).webkitPlaysInline = true;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('autoplay', 'true');
      audio.muted = false;
      audio.volume = 1.0;
      // Position off-screen so the browser keeps it in the render tree (never use display: none)
      audio.style.position = 'fixed';
      audio.style.top = '-9999px';
      audio.style.left = '-9999px';
      audio.style.width = '1px';
      audio.style.height = '1px';
      audio.style.opacity = '0.01';
      document.body.appendChild(audio);
      audioElementsRef.current.set(peerId, audio);
    }

    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }

    const playAudio = () => {
      if (!audio) return;
      audio.muted = false;
      audio.volume = 1.0;
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
      track.enabled = true;
      track.onunmute = () => {
        console.log(`[Audio] Track unmuted for peer: ${peerId}`);
        playAudio();
      };
    });
  }, []);

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

    const audio = audioElementsRef.current.get(peerId);
    if (audio) {
      try {
        audio.srcObject = null;
        audio.remove();
      } catch (e) {}
      audioElementsRef.current.delete(peerId);
    }

    peersInfoRef.current.delete(peerId);
    updatePeersState();
  }, [updatePeersState]);

  // Create or get RTCPeerConnection with W3C Perfect Negotiation pattern
  const getOrCreatePeerConnection = useCallback((remotePeerId: string): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(remotePeerId);
    if (pc) return pc;

    console.log(`[WebRTC] Creating RTCPeerConnection for: ${remotePeerId}`);
    pc = new RTCPeerConnection({ iceServers });
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
        sendWsMessage({
          type: 'signal',
          to: remotePeerId,
          data: { description: pc!.localDescription },
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

    // Connection state logging
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection with ${remotePeerId} is: ${pc!.connectionState}`);
      if (pc!.connectionState === 'failed') {
        pc!.restartIce();
      }
    };

    return pc;
  }, [sendWsMessage, handleRemoteStream]);

  // Handle incoming signaling message (W3C Perfect Negotiation)
  const handleSignal = useCallback(async (from: string, data: any) => {
    const pc = getOrCreatePeerConnection(from);
    const polite = myPeerIdRef.current > from;

    try {
      if (data.description) {
        const description = data.description;
        const isMakingOffer = makingOfferRef.current.get(from) || false;
        const offerCollision = (description.type === 'offer') &&
          (isMakingOffer || pc.signalingState !== 'stable');

        const ignoreOffer = !polite && offerCollision;
        ignoreOfferRef.current.set(from, ignoreOffer);

        if (ignoreOffer) {
          console.log(`[WebRTC] Collision detected with ${from} (impolite peer ignores offer)`);
          return;
        }

        await pc.setRemoteDescription(description);

        if (description.type === 'offer') {
          await pc.setLocalDescription();
          sendWsMessage({
            type: 'signal',
            to: from,
            data: { description: pc.localDescription },
          });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (err) {
          if (!ignoreOfferRef.current.get(from)) {
            console.warn(`[WebRTC] Error adding ICE candidate from ${from}:`, err);
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

  // Toggle microphone mute
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      const newMuted = !isMuted;
      audioTracks.forEach((track) => {
        track.enabled = !newMuted;
      });
      setIsMuted(newMuted);

      if (newMuted && isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        sendWsMessage({ type: 'speaking', isSpeaking: false });
      }

      sendWsMessage({
        type: 'update-mute',
        isMuted: newMuted,
      });
    }
  }, [isMuted, sendWsMessage]);

  // Main initialization effect
  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    const myPeerId = `vc-${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    myPeerIdRef.current = myPeerId;

    const init = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Ваш браузер не поддерживает доступ к микрофону или страница открыта не по HTTPS.');
        }

        setConnectionStatus('Запрос доступа к микрофону...');
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch (firstErr) {
          console.warn('Advanced audio constraints failed, falling back to basic audio: true', firstErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) {
          throw new Error('Микрофон не вернул аудиодорожку.');
        }
        audioTrack.enabled = true;
        streamRef.current = stream;

        // Setup Web Audio API for local VAD
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioContext = new AudioContextClass();
            if (audioContext.state === 'suspended') {
              audioContext.resume().catch(() => {});
            }
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.3;
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            vadIntervalRef.current = setInterval(() => {
              const now = Date.now();
              let stateChanged = false;

              // Auto-resume suspended AudioContext
              if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().catch(() => {});
              }

              // 1. Local mic VAD
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
                  let sum = 0;
                  for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                  }
                  const average = sum / dataArray.length;

                  // Sensitivity threshold: 6 out of 255
                  if (average > 6) {
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

              // 2. Remote peers VAD: verify via native getSynchronizationSources
              peerConnectionsRef.current.forEach((pc, remotePeerId) => {
                const peerInfo = peersInfoRef.current.get(remotePeerId);
                if (!peerInfo) return;

                let audioDetected = false;
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

        // Connect to WebSocket signaling server
        setConnectionStatus('Подключение к серверу...');
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        const isDev = window.location.port === '5173' || window.location.port === '5174';
        const wsUrl = isDev
          ? `ws://${window.location.hostname}:3000/peerjs/ws`
          : `${wsProtocol}//${wsHost}/peerjs/ws`;

        console.log(`[WS] Connecting to: ${wsUrl}`);
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
            console.log(`[WS] Received room-state with ${msg.peers.length} peers`);
            if (Array.isArray(msg.peers)) {
              msg.peers.forEach((p: PeerInfo) => {
                peersInfoRef.current.set(p.peerId, p);
                // Create PeerConnection for existing peer (triggers negotiation)
                getOrCreatePeerConnection(p.peerId);
              });
              updatePeersState();
            }
          }

          // Another peer joined the room
          else if (type === 'user-joined') {
            console.log(`[WS] Peer joined: ${msg.peer.peerId} (${msg.peer.nickname})`);
            peersInfoRef.current.set(msg.peer.peerId, msg.peer);
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
            cleanupPeer(msg.peerId);
          }
        };

        ws.onclose = () => {
          console.warn('[WS] WebSocket disconnected');
          setIsConnected(false);
          setConnectionStatus('Переподключение...');
        };

        ws.onerror = (err) => {
          console.error('[WS] WebSocket error:', err);
          setError('Ошибка подключения к серверу сигнализации.');
        };

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

      // Remove all audio elements
      audioElementsRef.current.forEach((audio) => {
        try {
          audio.srcObject = null;
          audio.remove();
        } catch (e) {}
      });
      audioElementsRef.current.clear();

      // Stop local microphone stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      peersInfoRef.current.clear();
      remoteHangoverRef.current.clear();
    };
  }, [roomId, unlockAudio, getOrCreatePeerConnection, handleSignal, cleanupPeer, updatePeersState, sendWsMessage]);

  return {
    isConnected,
    isMuted,
    isSpeaking,
    peers,
    error,
    connectionStatus,
    needsAudioUnlock,
    unlockAudio,
    toggleMute,
    changeNickname,
  };
}
