import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { MediaConnection, DataConnection } from 'peerjs';

export interface PeerInfo {
  peerId: string;
  nickname: string;
  isMuted: boolean;
}

interface UseVoiceChatOptions {
  roomId: string;
  nickname: string;
}

export function useVoiceChat({ roomId, nickname }: UseVoiceChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
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
  const isHostRef = useRef(false);
  const hostConnRef = useRef<DataConnection | null>(null);
  const initDoneRef = useRef(false);

  const roomHubId = `vc-room-${roomId}`;

  // Get PeerJS server configuration
  const getPeerOptions = useCallback((): any => {
    const peerServerHost = window.location.hostname;
    const peerServerPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    const peerServerPath = '/peerjs';
    
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

    return {
      host: peerServerHost,
      port: parseInt(peerServerPort, 10),
      path: peerServerPath,
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
      if (data.type === 'info') {
        if (!peersInfoRef.current.has(conn.peer)) {
          peersInfoRef.current.set(conn.peer, {
            peerId: conn.peer,
            nickname: data.nickname || 'Аноним',
            isMuted: false,
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

  const broadcastToAllPeers = useCallback((message: any, excludePeerId?: string) => {
    dataConnsRef.current.forEach((conn, peerId) => {
      if (conn.open && peerId !== excludePeerId) {
        conn.send(message);
      }
    });
  }, []);

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

        setConnectionStatus('Подключение к серверу...');
        const myPeerId = `vc-${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        myPeerIdRef.current = myPeerId;

        const peer = new Peer(myPeerId, getPeerOptions());
        peerRef.current = peer;

        // Setup common event handlers
        const setupPeerHandlers = (p: Peer) => {
          // Handle incoming calls
          p.on('call', (call) => {
            if (!streamRef.current) return;
            call.answer(streamRef.current);
            callsRef.current.set(call.peer, call);

            call.on('stream', (remoteStream) => {
              handleRemoteStream(call.peer, remoteStream);
            });

            call.on('close', () => cleanupPeer(call.peer));
            call.on('error', () => cleanupPeer(call.peer));
          });

          // Handle incoming data connections
          p.on('connection', (conn) => {
            dataConnsRef.current.set(conn.peer, conn);

            conn.on('open', () => {
              const remoteNickname = conn.metadata?.nickname || 'Аноним';
              if (!peersInfoRef.current.has(conn.peer)) {
                peersInfoRef.current.set(conn.peer, {
                  peerId: conn.peer,
                  nickname: remoteNickname,
                  isMuted: false,
                });
                updatePeersState();
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
              if (data.type === 'info') {
                if (!peersInfoRef.current.has(conn.peer)) {
                  peersInfoRef.current.set(conn.peer, {
                    peerId: conn.peer,
                    nickname: data.nickname || 'Аноним',
                    isMuted: false,
                  });
                  updatePeersState();
                }
              }
            });

            conn.on('close', () => {
              dataConnsRef.current.delete(conn.peer);
              cleanupPeer(conn.peer);
            });
          });

          p.on('error', (err) => {
            console.error('Peer error:', err);
            if (err.type === 'peer-unavailable') {
              // Peer not found, ok
            } else if (err.type === 'network' || err.type === 'server-error') {
              setError('Ошибка подключения к серверу. Попробуйте обновить страницу.');
            }
          });

          p.on('disconnected', () => {
            setConnectionStatus('Переподключение...');
            try {
              p.reconnect();
            } catch (e) {
              // ignore
            }
          });
        };

        setupPeerHandlers(peer);

        peer.on('open', () => {
          setConnectionStatus('Подключение к комнате...');
          setIsConnected(true);

          // Try to connect to room hub
          const hubConn = peer.connect(roomHubId, { reliable: true, metadata: { nickname } });
          let hubConnected = false;

          const hubTimeout = setTimeout(() => {
            if (!hubConnected) {
              // Hub not found, we become the hub
              becomeHub();
            }
          }, 3000);

          hubConn.on('open', () => {
            hubConnected = true;
            clearTimeout(hubTimeout);
            hostConnRef.current = hubConn;
            setConnectionStatus('Подключён к комнате ✓');

            // Send our info to hub
            hubConn.send({ type: 'join', nickname, peerId: myPeerId });
          });

          hubConn.on('data', (data: any) => {
            if (data.type === 'peer-list') {
              const peerList: Array<{ peerId: string; nickname: string }> = data.peers;
              peerList.forEach((p) => {
                if (p.peerId !== myPeerId) {
                  if (!peersInfoRef.current.has(p.peerId)) {
                    peersInfoRef.current.set(p.peerId, {
                      peerId: p.peerId,
                      nickname: p.nickname,
                      isMuted: false,
                    });
                  }
                  callPeer(p.peerId);
                  connectDataToPeer(p.peerId);
                }
              });
              updatePeersState();
            }
            if (data.type === 'new-peer') {
              const { peerId: newPeerId, nickname: newNickname } = data;
              if (newPeerId !== myPeerId) {
                if (!peersInfoRef.current.has(newPeerId)) {
                  peersInfoRef.current.set(newPeerId, {
                    peerId: newPeerId,
                    nickname: newNickname,
                    isMuted: false,
                  });
                }
                callPeer(newPeerId);
                connectDataToPeer(newPeerId);
                updatePeersState();
              }
            }
            if (data.type === 'peer-left') {
              cleanupPeer(data.peerId);
            }
          });

          hubConn.on('error', () => {
            if (!hubConnected) {
              clearTimeout(hubTimeout);
              becomeHub();
            }
          });

          hubConn.on('close', () => {
            hostConnRef.current = null;
            // Hub disconnected, try to become hub ourselves
            if (!isHostRef.current) {
              setTimeout(() => becomeHub(), 1000);
            }
          });
        });

        function becomeHub() {
          if (isHostRef.current) return;
          
          setConnectionStatus('Создание комнаты...');
          
          // We keep our existing peer but also register as hub
          // The hub ID is just a well-known ID that others can connect to
          // We don't need to destroy our peer - we just need to be reachable at roomHubId
          
          // Actually, PeerJS doesn't allow a peer to have multiple IDs.
          // So we need to destroy current peer and create a new one with hub ID.
          // But we need to keep our audio stream.
          
          const currentPeer = peerRef.current;
          if (currentPeer) {
            currentPeer.destroy();
          }
          
          const hubPeer = new Peer(roomHubId, getPeerOptions());
          peerRef.current = hubPeer;
          isHostRef.current = true;
          myPeerIdRef.current = roomHubId;

          setupPeerHandlers(hubPeer);

          hubPeer.on('open', () => {
            setConnectionStatus('Комната создана ✓ Ожидание участников...');
            
            // Hub needs to call all connected peers
            // But since we just became hub, there are no peers yet
            // New peers will connect to us and we'll call them
          });

          // Override connection handler for hub
          hubPeer.on('connection', (conn) => {
            dataConnsRef.current.set(conn.peer, conn);

            conn.on('open', () => {
              const remoteNickname = conn.metadata?.nickname || 'Аноним';
              if (!peersInfoRef.current.has(conn.peer)) {
                peersInfoRef.current.set(conn.peer, {
                  peerId: conn.peer,
                  nickname: remoteNickname,
                  isMuted: false,
                });
              }
              updatePeersState();

              // Send current peer list to new connection
              const peerList = Array.from(peersInfoRef.current.entries())
                .filter(([id]) => id !== conn.peer)
                .map(([, info]) => ({ peerId: info.peerId, nickname: info.nickname }));
              
              conn.send({ type: 'peer-list', peers: peerList });

              // Notify others about new peer
              broadcastToAllPeers(
                { type: 'new-peer', peerId: conn.peer, nickname: remoteNickname },
                conn.peer
              );

              // Call the new peer with audio
              if (streamRef.current) {
                const call = hubPeer.call(conn.peer, streamRef.current);
                if (call) {
                  callsRef.current.set(conn.peer, call);
                  call.on('stream', (remoteStream) => {
                    handleRemoteStream(conn.peer, remoteStream);
                  });
                  call.on('close', () => cleanupPeer(conn.peer));
                  call.on('error', () => cleanupPeer(conn.peer));
                }
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
            });

            conn.on('close', () => {
              dataConnsRef.current.delete(conn.peer);
              peersInfoRef.current.delete(conn.peer);
              updatePeersState();

              // Notify others
              broadcastToAllPeers({ type: 'peer-left', peerId: conn.peer });
              cleanupPeer(conn.peer);
            });
          });

          hubPeer.on('error', (err) => {
            console.error('Hub peer error:', err);
            if (err.type === 'unavailable-id') {
              // Someone else became hub, reconnect as client
              isHostRef.current = false;
              setConnectionStatus('Переподключение к хосту...');
              hubPeer.destroy();
              
              const clientPeer = new Peer(`vc-${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, getPeerOptions());
              peerRef.current = clientPeer;
              myPeerIdRef.current = clientPeer.id || '';
              
              setupPeerHandlers(clientPeer);
              
              clientPeer.on('open', () => {
                setConnectionStatus('Подключён к комнате ✓');
                setIsConnected(true);
                const hubConn2 = clientPeer.connect(roomHubId, { reliable: true, metadata: { nickname } });
                hubConn2.on('open', () => {
                  hubConn2.send({ type: 'join', nickname, peerId: myPeerIdRef.current });
                });
                hubConn2.on('data', (data: any) => {
                  if (data.type === 'peer-list') {
                    data.peers.forEach((p: any) => {
                      if (p.peerId !== myPeerIdRef.current) {
                        if (!peersInfoRef.current.has(p.peerId)) {
                          peersInfoRef.current.set(p.peerId, { peerId: p.peerId, nickname: p.nickname, isMuted: false });
                        }
                        callPeer(p.peerId);
                        connectDataToPeer(p.peerId);
                      }
                    });
                    updatePeersState();
                  }
                  if (data.type === 'new-peer') {
                    if (data.peerId !== myPeerIdRef.current) {
                      if (!peersInfoRef.current.has(data.peerId)) {
                        peersInfoRef.current.set(data.peerId, { peerId: data.peerId, nickname: data.nickname, isMuted: false });
                      }
                      callPeer(data.peerId);
                      connectDataToPeer(data.peerId);
                      updatePeersState();
                    }
                  }
                });
              });
            }
          });
        }
      } catch (err) {
        console.error('Init error:', err);
        setError('Не удалось получить доступ к микрофону. Разрешите доступ в настройках браузера.');
      }
    };

    init();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      audioElementsRef.current.forEach((audio) => {
        audio.srcObject = null;
        audio.remove();
      });
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

      // Broadcast mute status
      dataConnsRef.current.forEach((conn) => {
        if (conn.open) {
          conn.send({ type: 'mute-status', isMuted: newMuted });
        }
      });
    }
  }, []);

  return {
    isConnected,
    isMuted,
    peers,
    error,
    connectionStatus,
    toggleMute,
  };
}
