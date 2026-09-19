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
  const remoteAnalysersRef = useRef<Map<string, { analyser: AnalyserNode; dataArray: any; hangover: number }>>(new Map());
  const remoteHangoverRef = useRef<Map<string, number>>(new Map());
  const peerJoinTimesRef = useRef<Map<string, number>>(new Map());

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
    const peerOptions: any = {
      host: peerServerHost,
      path: '/peerjs',
      secure: window.location.protocol === 'https:',
      debug: 1,
      config: {
        iceServers: defaultIceServers,
      },
    };

    if (peerServerPort && peerServerPort !== '443' && peerServerPort !== '80') {
      peerOptions.port = parseInt(peerServerPort, 10);
    }

    return peerOptions;
  }, []);

  const updatePeersState = useCallback(() => {
    const peerList = Array.from(peersInfoRef.current.values());
    setPeers([...peerList]);
  }, []);

  const cleanupPeerCall = useCallback((peerId: string, closingCall?: MediaConnection) => {
    const currentCall = callsRef.current.get(peerId);
    if (closingCall && currentCall && currentCall !== closingCall) {
      console.log(`[Call] Ignoring close for superseded call with ${peerId}`);
      return;
    }

    if (currentCall) {
      try {
        currentCall.close();
      } catch (e) {}
      callsRef.current.delete(peerId);
    }

    const audio = audioElementsRef.current.get(peerId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      audioElementsRef.current.delete(peerId);
    }

    remoteAnalysersRef.current.delete(peerId);
    remoteHangoverRef.current.delete(peerId);
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    cleanupPeerCall(peerId);

    const dataConn = dataConnsRef.current.get(peerId);
    if (dataConn) {
      dataConn.close();
      dataConnsRef.current.delete(peerId);
    }

    peerJoinTimesRef.current.delete(peerId);
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
      audio.muted = false;
      audio.volume = 1.0;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audioElementsRef.current.set(peerId, audio);
    }
    
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }

    // Attach Web Audio API analyser to remote stream for receiver-side VAD (green ring fallback)
    const attachReceiverAnalyser = () => {
      try {
        if (audioContextRef.current && !remoteAnalysersRef.current.has(peerId)) {
          const remoteAnalyser = audioContextRef.current.createAnalyser();
          remoteAnalyser.fftSize = 256;
          remoteAnalyser.smoothingTimeConstant = 0.3;
          const remoteSource = audioContextRef.current.createMediaStreamSource(stream);
          remoteSource.connect(remoteAnalyser);
          remoteAnalysersRef.current.set(peerId, {
            analyser: remoteAnalyser,
            dataArray: new Uint8Array(remoteAnalyser.frequencyBinCount),
            hangover: 0,
          });
          console.log(`[VAD] Attached receiver VAD analyser to remote stream of: ${peerId}`);
        }
      } catch (vadErr) {
        console.warn(`[VAD] Failed to attach receiver VAD for ${peerId}:`, vadErr);
      }
    };

    attachReceiverAnalyser();

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
        attachReceiverAnalyser();
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
      cleanupPeerCall(remotePeerId, call);
    });
    call.on('error', (err) => {
      console.warn(`[Call] Outgoing call error with ${remotePeerId}:`, err);
      cleanupPeerCall(remotePeerId, call);
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
          if (data.isSpeaking) {
            remoteHangoverRef.current.set(conn.peer, Date.now() + 400);
          }
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
      // ONLY remove from dataConns, NEVER kill the peer connection on data close
      dataConnsRef.current.delete(conn.peer);
    });
    conn.on('error', () => {
      dataConnsRef.current.delete(conn.peer);
    });
  }, [nickname, updatePeersState]);

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

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

        // Set up Web Audio API for Voice Activity Detection (VAD)
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

              // Ensure AudioContext is active if browser suspended it
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
                    broadcastSpeakingStatus(false);
                  }
                } else {
                  analyserRef.current.getByteFrequencyData(dataArray);
                  let sum = 0;
                  for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                  }
                  const average = sum / dataArray.length;

                  // Speech threshold: average > 6 (out of 255)
                  if (average > 6) {
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
                }
              }

              // 2. Remote streams VAD (receiver-side volume detection for green avatars)
              // First checks RTCRtpReceiver.getSynchronizationSources() (native WebRTC, 100% reliable in Chromium)
              // Then falls back to remoteAnalyser (Web Audio API)
              callsRef.current.forEach((call, remotePeerId) => {
                const peerInfo = peersInfoRef.current.get(remotePeerId);
                if (!peerInfo) return;

                let remoteIsSpeaking = false;

                // A. Native WebRTC receiver synchronization sources (RFC 6464 audio level)
                try {
                  const pc: any = call.peerConnection;
                  if (pc && typeof pc.getReceivers === 'function') {
                    const receivers = pc.getReceivers();
                    for (const receiver of receivers) {
                      if (receiver.track && receiver.track.kind === 'audio' && typeof receiver.getSynchronizationSources === 'function') {
                        const syncSources = receiver.getSynchronizationSources();
                        for (const src of syncSources) {
                          if (typeof src.audioLevel === 'number' && src.audioLevel > 0.01) {
                            remoteIsSpeaking = true;
                            break;
                          }
                          if (src.voiceActivityFlag === true) {
                            remoteIsSpeaking = true;
                            break;
                          }
                        }
                      }
                      if (remoteIsSpeaking) break;
                    }
                  }
                } catch (e) {
                  // Ignore
                }

                // B. Web Audio API analyser fallback
                if (!remoteIsSpeaking) {
                  const remoteVad = remoteAnalysersRef.current.get(remotePeerId);
                  if (remoteVad) {
                    remoteVad.analyser.getByteFrequencyData(remoteVad.dataArray);
                    let sum = 0;
                    for (let i = 0; i < remoteVad.dataArray.length; i++) {
                      sum += remoteVad.dataArray[i];
                    }
                    const avg = sum / remoteVad.dataArray.length;
                    if (avg > 6) {
                      remoteIsSpeaking = true;
                    }
                  }
                }

                let remoteHangover = remoteHangoverRef.current.get(remotePeerId) || 0;
                if (remoteIsSpeaking) {
                  remoteHangover = now + 400;
                  remoteHangoverRef.current.set(remotePeerId, remoteHangover);
                  if (!peerInfo.isSpeaking) {
                    peerInfo.isSpeaking = true;
                    peersInfoRef.current.set(remotePeerId, peerInfo);
                    stateChanged = true;
                  }
                } else if (peerInfo.isSpeaking && now > remoteHangover) {
                  peerInfo.isSpeaking = false;
                  peersInfoRef.current.set(remotePeerId, peerInfo);
                  stateChanged = true;
                }
              });

              if (stateChanged) {
                updatePeersState();
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

          // Immediately ensure peer is in peersInfoRef so receiver VAD can update their avatar
          if (!peersInfoRef.current.has(call.peer)) {
            peersInfoRef.current.set(call.peer, {
              peerId: call.peer,
              nickname: 'Участник',
              isMuted: false,
              isSpeaking: false,
            });
            updatePeersState();
          }

          call.answer(streamRef.current);
          callsRef.current.set(call.peer, call);

          call.on('stream', (remoteStream) => {
            console.log(`[Call] Stream received from incoming call: ${call.peer}`);
            handleRemoteStream(call.peer, remoteStream);
          });

          call.on('close', () => {
            console.log(`[Call] Incoming call closed with: ${call.peer}`);
            cleanupPeerCall(call.peer, call);
          });
          call.on('error', (err) => {
            console.warn(`[Call] Incoming call error with ${call.peer}:`, err);
            cleanupPeerCall(call.peer, call);
          });
        });

        peer.on('connection', (conn) => {
          console.log(`[Data] Incoming connection from: ${conn.peer}`);
          dataConnsRef.current.set(conn.peer, conn);

          const setupConn = () => {
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
            try {
              conn.send({ type: 'info', nickname, peerId: myPeerIdRef.current });
            } catch (e) {}

            // Deterministic caller rule: only initiate call if myId < remoteId
            if (!callsRef.current.has(conn.peer) && shouldInitiateCall(myPeerIdRef.current, conn.peer)) {
              console.log(`[Call] Initiating call to ${conn.peer} (deterministic caller rule)`);
              callPeer(conn.peer);
            }
          };

          if (conn.open) {
            setupConn();
          } else {
            conn.on('open', setupConn);
          }

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
                if (data.isSpeaking) {
                  remoteHangoverRef.current.set(conn.peer, Date.now() + 400);
                }
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
            // ONLY remove data connection, NEVER kill the peer or audio
            dataConnsRef.current.delete(conn.peer);
          });
          conn.on('error', () => {
            dataConnsRef.current.delete(conn.peer);
          });
        });

        peer.on('error', (err: any) => {
          console.error('[Peer] Error:', err);
          const errType = err?.type || '';
          const errMsg = err?.message || errType || 'Неизвестная ошибка';

          if (errType === 'peer-unavailable') {
            // Remote peer not available or left - non-fatal
            return;
          }

          if (errType === 'network' || errType === 'server-error' || errType === 'socket-error' || errType === 'socket-closed') {
            setError('Ошибка подключения к серверу сигнализации. Попробуйте обновить страницу.');
          } else if (errType === 'ssl-unavailable') {
            setError('HTTPS требуется для работы голосового чата.');
          } else if (errType === 'browser-incompatible') {
            setError('Ваш браузер не поддерживает WebRTC.');
          } else if (errType === 'invalid-id') {
            setError('Неверный ID пользователя.');
          } else {
            setError(`Ошибка подключения (${errType}): ${errMsg}`);
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

            // Connect to each existing peer in the room immediately
            if (joinData.peers && Array.isArray(joinData.peers)) {
              joinData.peers.forEach((p: { peerId: string; nickname: string }) => {
                if (p.peerId !== assignedId) {
                  peersInfoRef.current.set(p.peerId, {
                    peerId: p.peerId,
                    nickname: p.nickname || 'Аноним',
                    isMuted: false,
                    isSpeaking: false,
                  });
                  peerJoinTimesRef.current.set(p.peerId, Date.now());
                  connectDataToPeer(p.peerId);
                  // Deterministic call: only if assignedId < p.peerId
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
                        peerJoinTimesRef.current.set(p.peerId, Date.now());
                        updatePeersState();
                      }
                      if (!dataConnsRef.current.has(p.peerId)) {
                        connectDataToPeer(p.peerId);
                      }
                      if (!callsRef.current.has(p.peerId)) {
                        const joinTime = peerJoinTimesRef.current.get(p.peerId) || Date.now();
                        // Call if designated initiator or fallback after 6s
                        if (shouldInitiateCall(myPeerIdRef.current, p.peerId) || (Date.now() - joinTime > 6000)) {
                          callPeer(p.peerId);
                        }
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
      remoteAnalysersRef.current.clear();
      remoteHangoverRef.current.clear();
      peerJoinTimesRef.current.clear();
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
