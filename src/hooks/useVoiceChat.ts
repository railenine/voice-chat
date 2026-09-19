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

  // Get PeerJS server configuration
  const getPeerOptions = useCallback((): any => {
    const peerServerHost = window.location.hostname;
    const peerServerPort = window.location.port;
    
    // For dev mode (Vite), use public PeerJS server
    const isDev = peerServerPort === '5173' || peerServerPort === '5174';
    
    if (isDev && (peerServerHost === 'localhost' || peerServerHost === '127.0.0.1')) {
      return {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        },
      };
    }

    // For production, connect to our own PeerJS server
    // CORRECT CONFIGURATION:
    // - Client: path: '/peerjs' → HTTP: /peerjs/id, WebSocket: /peerjs/peerjs
    // - Server: path: '/peerjs' + app.use(peerServer) → handles /peerjs/* ✓
    
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
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      },
    };
  }, []);

  const updatePeersState = useCallback(() => {
    const peerList = Array.from(peersInfoRef.current.values());
    setPeers([...peerList]);
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    const call = callsRef.current.get(peerId);
    if (call) {
      call.close();
      callsRef.current.delete(peerId);
    }

    const dataConn = dataConnsRef.current.get(peerId);
    if (dataConn) {
      dataConn.close();
      dataConnsRef.current.delete(peerId);
    }

    const audio = audioElementsRef.current.get(peerId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      audioElementsRef.current.delete(peerId);
    }

    peersInfoRef.current.delete(peerId);
    updatePeersState();
  }, [updatePeersState]);

  const handleRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    let audio = audioElementsRef.current.get(peerId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      document.body.appendChild(audio);
      audioElementsRef.current.set(peerId, audio);
    }
    audio.srcObject = stream;
    audio.play().catch(() => {});
  }, []);

  const callPeer = useCallback((remotePeerId: string) => {
    if (!peerRef.current || !streamRef.current || callsRef.current.has(remotePeerId)) return;

    const call = peerRef.current.call(remotePeerId, streamRef.current);
    if (!call) return;

    callsRef.current.set(remotePeerId, call);

    call.on('stream', (remoteStream) => {
      handleRemoteStream(remotePeerId, remoteStream);
    });

    call.on('close', () => cleanupPeer(remotePeerId));
    call.on('error', () => cleanupPeer(remotePeerId));
  }, [handleRemoteStream, cleanupPeer]);

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
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
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

              if (audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
              }

              const audioTrack = streamRef.current.getAudioTracks()[0];
              if (!audioTrack || !audioTrack.enabled) {
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

              // Speech threshold: average > 14 (out of 255)
              if (average > 14) {
                speechHangoverRef.current = now + 350;
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
          if (!streamRef.current) return;
          call.answer(streamRef.current);
          callsRef.current.set(call.peer, call);

          call.on('stream', (remoteStream) => {
            console.log(`[Call] Stream received from: ${call.peer}`);
            handleRemoteStream(call.peer, remoteStream);
          });

          call.on('close', () => cleanupPeer(call.peer));
          call.on('error', (err) => {
            console.warn(`[Call] Error with ${call.peer}:`, err);
            cleanupPeer(call.peer);
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
                  callPeer(p.peerId);
                  connectDataToPeer(p.peerId);
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
                      if (!callsRef.current.has(p.peerId)) {
                        callPeer(p.peerId);
                      }
                      if (!dataConnsRef.current.has(p.peerId)) {
                        connectDataToPeer(p.peerId);
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

    // Unlock audio on first user interaction
    const unlockAudio = () => {
      audioElementsRef.current.forEach((audio) => {
        if (audio.paused) {
          audio.play().catch(() => {});
        }
      });
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);

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
  }, [roomId, nickname]); // eslint-disable-line react-hooks/exhaustive-deps

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
    toggleMute,
  };
}
