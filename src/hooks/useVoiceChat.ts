import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { MediaConnection, DataConnection } from 'peerjs';
//UPD
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

  const peerRef = useRef<Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());
  const dataConnsRef = useRef<Map<string, DataConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const peersInfoRef = useRef<Map<string, PeerInfo>>(new Map());
  const myPeerIdRef = useRef<string>('');
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initDoneRef = useRef(false);

  // VAD (Voice Activity Detection) refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef(false);
  const speechHangoverRef = useRef<number>(0);

  // Deterministic caller rule to prevent call collisions (glare) in P2P mesh
  const shouldInitiateCall = useCallback((myId: string, remoteId: string): boolean => {
    return myId < remoteId;
  }, []);

  // Unlock audio playback (resumes AudioContext and starts any paused <audio> elements)
  const unlockAudio = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch((err) => console.warn('AudioContext resume failed:', err));
    }

    let allPlaying = true;
    audioElementsRef.current.forEach((audio, peerId) => {
      if (audio.paused) {
        audio.play().then(() => {
          console.log(`[Audio] Unlocked playback for ${peerId}`);
        }).catch((err) => {
          console.warn(`[Audio] Unlock play failed for ${peerId}:`, err);
          allPlaying = false;
        });
      }
    });

    if (allPlaying) {
      setNeedsAudioUnlock(false);
    }
  }, []);

  // Get PeerJS server configuration
  const getPeerOptions = useCallback((): any => {
    const peerServerHost = window.location.hostname;
    const peerServerPort = window.location.port;

    const defaultIceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ];
    
    // For dev mode (Vite), use public PeerJS server
    const isDev = peerServerPort === '5173' || peerServerPort === '5174';
    
    if (isDev && (peerServerHost === 'localhost' || peerServerHost === '127.0.0.1')) {
      return {
        debug: 0,
        config: {
          iceServers: defaultIceServers,
        },
      };
    }

    // Determine port number
    let port: number;
    if (peerServerPort) {
      port = parseInt(peerServerPort, 10);
    } else {
      // Default ports based on protocol
      port = window.location.protocol === 'https:' ? 443 : 80;
    }
    
    return {
      host: peerServerHost,
      port: port,
      path: '/peerjs',
      secure: window.location.protocol === 'https:',
      debug: 0,
      config: {
        iceServers: defaultIceServers,
      },
    };
  }, []);

  const updatePeersState = useCallback(() => {
    const peerList = Array.from(peersInfoRef.current.values());
    setPeers([...peerList]);
  }, []);

  const cleanupPeerCall = useCallback((peerId: string) => {
    const call = callsRef.current.get(peerId);
    if (call) {
      call.close();
      callsRef.current.delete(peerId);
    }

    const audio = audioElementsRef.current.get(peerId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      audioElementsRef.current.delete(peerId);
    }
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    cleanupPeerCall(peerId);

    const dataConn = dataConnsRef.current.get(peerId);
    if (dataConn) {
      dataConn.close();
      dataConnsRef.current.delete(peerId);
    }

    peersInfoRef.current.delete(peerId);
    updatePeersState();
  }, [cleanupPeerCall, updatePeersState]);

  const handleRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    console.log(`[Stream] Received remote stream for peer: ${peerId}`);
    let audio = audioElementsRef.current.get(peerId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      (audio as any).playsInline = true;
      (audio as any).webkitPlaysInline = true;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('autoplay', 'true');
      document.body.appendChild(audio);
      audioElementsRef.current.set(peerId, audio);
    }
    
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }

    const playAudio = () => {
      if (!audio) return;
      audio.play().then(() => {
        console.log(`[Audio] Playing audio for peer ${peerId}`);
        setNeedsAudioUnlock(false);
      }).catch((err) => {
        console.warn(`[Audio] Autoplay blocked for peer ${peerId}:`, err);
        setNeedsAudioUnlock(true);
      });
    };

    playAudio();

    // Ensure tracks are unmuted and enabled
    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
      track.onunmute = () => {
        console.log(`[Stream] Track unmuted for peer: ${peerId}`);
        playAudio();
      };
    });
  }, []);

  const callPeer = useCallback((remotePeerId: string) => {
    if (!peerRef.current || !streamRef.current || callsRef.current.has(remotePeerId)) return;

    console.log(`[Call] Calling peer: ${remotePeerId}`);
    const call = peerRef.current.call(remotePeerId, streamRef.current);
    if (!call) return;

    callsRef.current.set(remotePeerId, call);

    call.on('stream', (remoteStream) => {
      console.log(`[Call] Stream received from outgoing call to: ${remotePeerId}`);
      handleRemoteStream(remotePeerId, remoteStream);
    });

    call.on('close', () => {
      console.log(`[Call] Outgoing call closed with: ${remotePeerId}`);
      cleanupPeerCall(remotePeerId);
    });
    call.on('error', (err) => {
      console.warn(`[Call] Outgoing call error with ${remotePeerId}:`, err);
      cleanupPeerCall(remotePeerId);
    });
  }, [handleRemoteStream, cleanupPeerCall]);

  const broadcastToAllPeers = useCallback((message: any, excludePeerId?: string) => {
    dataConnsRef.current.forEach((conn, peerId) => {
      if (conn.open && peerId !== excludePeerId) {
        conn.send(message);
      }
    });
  }, []);

  const broadcastSpeakingStatus = useCallback((speaking: boolean) => {
    broadcastToAllPeers({ type: 'speaking-status', isSpeaking: speaking });
  }, [broadcastToAllPeers]);

  const connectDataToPeer = useCallback((remotePeerId: string) => {
    if (!peerRef.current || dataConnsRef.current.has(remotePeerId)) return;

    const conn = peerRef.current.connect(remotePeerId, { reliable: true, metadata: { nickname } });
    if (!conn) return;

    dataConnsRef.current.set(remotePeerId, conn);

    conn.on('open', () => {
      conn.send({ type: 'info', nickname, peerId: myPeerIdRef.current });
    });

    conn.on('data', (data: any) => {
      if (data.type === 'mute-status') {
        const info = peersInfoRef.current.get(conn.peer);
        if (info) {
          info.isMuted = data.isMuted;
          peersInfoRef.current.set(conn.peer, info);
          updatePeersState();
        }
      }
      if (data.type === 'speaking-status') {
        const info = peersInfoRef.current.get(conn.peer);
        if (info) {
          info.isSpeaking = data.isSpeaking;
          peersInfoRef.current.set(conn.peer, info);
          updatePeersState();
        }
      }
      if (data.type === 'info') {
        if (!peersInfoRef.current.has(conn.peer)) {
          peersInfoRef.current.set(conn.peer, {
            peerId: conn.peer,
            nickname: data.nickname || 'Аноним',
            isMuted: false,
            isSpeaking: false,
          });
          updatePeersState();
        }
      }
    });

    conn.on('close', () => {
      dataConnsRef.current.delete(conn.peer);
      cleanupPeer(conn.peer);
    });
  }, [nickname, cleanupPeer, updatePeersState]);

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    const init = async () => {
      try {
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

        // Set up Web Audio API for Voice Activity Detection (VAD)
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioContext = new AudioContextClass();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.3;
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            vadIntervalRef.current = setInterval(() => {
              if (!analyserRef.current || !streamRef.current) return;

              const track = streamRef.current.getAudioTracks()[0];
              if (!track || !track.enabled) {
                if (isSpeakingRef.current) {
                  isSpeakingRef.current = false;
                  setIsSpeaking(false);
                  broadcastSpeakingStatus(false);
                }
                return;
              }

              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const average = sum / dataArray.length;
              const now = Date.now();

              // Speech threshold: average > 10 (out of 255)
              if (average > 10) {
                speechHangoverRef.current = now + 400;
                if (!isSpeakingRef.current) {
                  isSpeakingRef.current = true;
                  setIsSpeaking(true);
                  broadcastSpeakingStatus(true);
                }
              } else if (isSpeakingRef.current && now > speechHangoverRef.current) {
                isSpeakingRef.current = false;
                setIsSpeaking(false);
                broadcastSpeakingStatus(false);
              }
            }, 60);
          }
        } catch (vadErr) {
          console.warn('VAD initialization failed:', vadErr);
        }

        setConnectionStatus('Подключение к серверу...');
        const myPeerId = `vc-${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        myPeerIdRef.current = myPeerId;

        const peer = new Peer(myPeerId, getPeerOptions());
        peerRef.current = peer;

        // Setup peer event handlers
        peer.on('call', (call) => {
          console.log(`[Call] Incoming call from: ${call.peer}`);
          if (!streamRef.current) {
            console.warn('[Call] Cannot answer incoming call: local stream not available');
            return;
          }
          call.answer(streamRef.current);
          callsRef.current.set(call.peer, call);

          call.on('stream', (remoteStream) => {
            console.log(`[Call] Stream received from incoming call: ${call.peer}`);
            handleRemoteStream(call.peer, remoteStream);
          });

          call.on('close', () => {
            console.log(`[Call] Incoming call closed with: ${call.peer}`);
            cleanupPeerCall(call.peer);
          });
          call.on('error', (err) => {
            console.warn(`[Call] Incoming call error with ${call.peer}:`, err);
            cleanupPeerCall(call.peer);
          });
        });

        peer.on('connection', (conn) => {
          console.log(`[Data] Incoming connection from: ${conn.peer}`);
          dataConnsRef.current.set(conn.peer, conn);

          conn.on('open', () => {
            const remoteNickname = conn.metadata?.nickname || 'Аноним';
            const existing = peersInfoRef.current.get(conn.peer);
            peersInfoRef.current.set(conn.peer, {
              peerId: conn.peer,
              nickname: existing?.nickname || remoteNickname,
              isMuted: existing?.isMuted || false,
              isSpeaking: existing?.isSpeaking || false,
            });
            updatePeersState();

            // Send our info back
            conn.send({ type: 'info', nickname, peerId: myPeerIdRef.current });

            // If we are designated caller and haven't called yet, initiate call now
            if (shouldInitiateCall(myPeerIdRef.current, conn.peer) && !callsRef.current.has(conn.peer)) {
              console.log(`[Call] Incoming data connection from ${conn.peer} -> initiating call`);
              callPeer(conn.peer);
            }
          });

          conn.on('data', (data: any) => {
            if (data.type === 'mute-status') {
              const info = peersInfoRef.current.get(conn.peer);
              if (info) {
                info.isMuted = data.isMuted;
                peersInfoRef.current.set(conn.peer, info);
                updatePeersState();
              }
            }
            if (data.type === 'speaking-status') {
              const info = peersInfoRef.current.get(conn.peer);
              if (info) {
                info.isSpeaking = data.isSpeaking;
                peersInfoRef.current.set(conn.peer, info);
                updatePeersState();
              }
            }
            if (data.type === 'info') {
              const existing = peersInfoRef.current.get(conn.peer);
              peersInfoRef.current.set(conn.peer, {
                peerId: conn.peer,
                nickname: data.nickname || existing?.nickname || 'Аноним',
                isMuted: existing?.isMuted || false,
                isSpeaking: existing?.isSpeaking || false,
              });
              updatePeersState();
            }
          });

          conn.on('close', () => {
            dataConnsRef.current.delete(conn.peer);
            cleanupPeer(conn.peer);
          });
          conn.on('error', () => {
            dataConnsRef.current.delete(conn.peer);
            cleanupPeer(conn.peer);
          });
        });

        peer.on('error', (err) => {
          console.error('[Peer] Error:', err);
          if (err.type === 'peer-unavailable') {
            // Remote peer not available or left
          } else if (err.type === 'network' || err.type === 'server-error') {
            setError('Ошибка подключения к серверу. Попробуйте обновить страницу.');
          } else if (err.type === 'ssl-unavailable') {
            setError('HTTPS требуется для работы голосового чата.');
          } else if (err.type === 'browser-incompatible') {
            setError('Ваш браузер не поддерживает WebRTC.');
          } else if (err.type === 'invalid-id') {
            setError('Неверный ID пользователя.');
          }
        });

        peer.on('disconnected', () => {
          setConnectionStatus('Переподключение...');
          try {
            peer.reconnect();
          } catch (e) {}
        });

        peer.on('open', async (assignedId) => {
          setConnectionStatus('Подключение к комнате...');
          setIsConnected(true);
          myPeerIdRef.current = assignedId;

          try {
            // Join room on backend
            const joinRes = await fetch(`/peerjs/rooms/${roomId}/join`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ peerId: assignedId, nickname }),
            });
            const joinData = await joinRes.json();
            setConnectionStatus('В комнате ✓');

            // Connect to each existing peer in the room
            if (joinData.peers && Array.isArray(joinData.peers)) {
              joinData.peers.forEach((p: { peerId: string; nickname: string }) => {
                if (p.peerId !== assignedId) {
                  peersInfoRef.current.set(p.peerId, {
                    peerId: p.peerId,
                    nickname: p.nickname || 'Аноним',
                    isMuted: false,
                    isSpeaking: false,
                  });
                  connectDataToPeer(p.peerId);
                  if (shouldInitiateCall(assignedId, p.peerId)) {
                    callPeer(p.peerId);
                  }
                }
              });
              updatePeersState();
            }

            // Start heartbeat polling every 3 seconds
            heartbeatTimerRef.current = setInterval(async () => {
              if (!peerRef.current || peerRef.current.destroyed) return;
              try {
                const hbRes = await fetch(`/peerjs/rooms/${roomId}/heartbeat`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ peerId: myPeerIdRef.current }),
                });
                const hbData = await hbRes.json();
                if (hbData.peers && Array.isArray(hbData.peers)) {
                  const activePeerIds = new Set(hbData.peers.map((p: any) => p.peerId));

                  // Connect to any new peers
                  hbData.peers.forEach((p: { peerId: string; nickname: string }) => {
                    if (p.peerId !== myPeerIdRef.current) {
                      if (!peersInfoRef.current.has(p.peerId)) {
                        peersInfoRef.current.set(p.peerId, {
                          peerId: p.peerId,
                          nickname: p.nickname || 'Аноним',
                          isMuted: false,
                          isSpeaking: false,
                        });
                        updatePeersState();
                      }
                      if (!dataConnsRef.current.has(p.peerId)) {
                        connectDataToPeer(p.peerId);
                      }
                      if (shouldInitiateCall(myPeerIdRef.current, p.peerId) && !callsRef.current.has(p.peerId)) {
                        callPeer(p.peerId);
                      }
                    }
                  });

                  // Remove peers that have left the room
                  peersInfoRef.current.forEach((_, id) => {
                    if (!activePeerIds.has(id)) {
                      cleanupPeer(id);
                    }
                  });
                }
              } catch (hbErr) {
                // Heartbeat error ignored
              }
            }, 3000);
          } catch (joinErr) {
            console.error('[Room] Join error:', joinErr);
            setError('Не удалось подключиться к комнате.');
          }
        });
      } catch (err: any) {
        console.error('Init error:', err);
        
        // Handle different error types
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('Микрофон не найден. Подключите микрофон и попробуйте снова.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Не удалось получить доступ к микрофону. Возможно, он используется другим приложением.');
        } else if (err.name === 'OverconstrainedError') {
          setError('Микрофон не поддерживает необходимые параметры.');
        } else {
          setError('Не удалось получить доступ к микрофону. Проверьте настройки браузера.');
        }
      }
    };

    init();

    // Unlock audio on any user interaction
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);

      // Stop heartbeat timer
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }

      // Notify backend we left
      if (myPeerIdRef.current) {
        try {
          fetch(`/peerjs/rooms/${roomId}/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ peerId: myPeerIdRef.current }),
            keepalive: true,
          }).catch(() => {});
        } catch (e) {}
      }

      // Cleanup VAD interval and AudioContext
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {
          // Ignore
        }
        audioContextRef.current = null;
        analyserRef.current = null;
      }

      // Cleanup audio stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      
      // Cleanup peer connection
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (e) {
          // Ignore destroy errors
        }
        peerRef.current = null;
      }
      
      // Cleanup all audio elements
      audioElementsRef.current.forEach((audio) => {
        try {
          audio.srcObject = null;
          audio.remove();
        } catch (e) {
          // Ignore removal errors
        }
      });
      audioElementsRef.current.clear();
      
      // Cleanup refs
      callsRef.current.clear();
      dataConnsRef.current.clear();
      peersInfoRef.current.clear();
    };
  }, [roomId, nickname, shouldInitiateCall, unlockAudio, callPeer, connectDataToPeer, cleanupPeer, cleanupPeerCall, handleRemoteStream, updatePeersState, broadcastSpeakingStatus, getPeerOptions]);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      const newMuted = !audioTracks[0]?.enabled;
      setIsMuted(newMuted);

      if (newMuted && isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        broadcastSpeakingStatus(false);
      }

      // Broadcast mute status
      dataConnsRef.current.forEach((conn) => {
        if (conn.open) {
          conn.send({ type: 'mute-status', isMuted: newMuted });
        }
      });
    }
  }, [broadcastSpeakingStatus]);

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
  };
}
