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
  const [isHost, setIsHost] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());
  const dataConnsRef = useRef<Map<string, DataConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const peersInfoRef = useRef<Map<string, PeerInfo>>(new Map());
  const myPeerIdRef = useRef<string>('');
  const isHostRef = useRef(false);
  const hostConnRef = useRef<DataConnection | null>(null);

  const roomHubId = `vc-room-${roomId}`;

  const updatePeersState = useCallback(() => {
    const peerList = Array.from(peersInfoRef.current.values());
    setPeers(peerList);
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

        const peer = new Peer(myPeerId, {
          debug: 0,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
            ],
          },
        });
        peerRef.current = peer;

        peer.on('open', () => {
          setConnectionStatus('Подключение к комнате...');
          setIsConnected(true);

          // Try to connect to room hub
          const hubConn = peer.connect(roomHubId, { reliable: true, metadata: { nickname } });
          let hubConnected = false;

          const hubTimeout = setTimeout(() => {
            if (!hubConnected) {
              // Hub not found, we become the hub
              becomeHub(peer);
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
              // Hub sent us the list of peers to connect to
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
              // Hub tells us about a new peer
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
              becomeHub(peer);
            }
          });

          hubConn.on('close', () => {
            // Hub disconnected, try to become hub
            hostConnRef.current = null;
            setTimeout(() => becomeHub(peer), 1000);
          });
        });

        // Handle incoming calls
        peer.on('call', (call) => {
          call.answer(stream);
          callsRef.current.set(call.peer, call);

          call.on('stream', (remoteStream) => {
            handleRemoteStream(call.peer, remoteStream);
          });

          call.on('close', () => cleanupPeer(call.peer));
          call.on('error', () => cleanupPeer(call.peer));
        });

        // Handle incoming data connections
        peer.on('connection', (conn) => {
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

        peer.on('error', (err) => {
          console.error('Peer error:', err);
          if (err.type === 'unavailable-id') {
            // Room hub ID is taken, connect as client
            setConnectionStatus('Подключение к хосту комнаты...');
          } else if (err.type === 'peer-unavailable') {
            // Peer not found, ok
          } else if (err.type === 'network' || err.type === 'server-error') {
            setError('Ошибка подключения к серверу. Попробуйте обновить страницу.');
          }
        });

        peer.on('disconnected', () => {
          setConnectionStatus('Переподключение...');
          try {
            peer.reconnect();
          } catch (e) {
            // ignore
          }
        });

        function becomeHub(p: Peer) {
          if (isHostRef.current) return;
          
          // Destroy current peer and recreate with hub ID
          setConnectionStatus('Создание комнаты...');
          
          p.destroy();
          
          const hubPeer = new Peer(roomHubId, {
            debug: 0,
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
              ],
            },
          });
          
          peerRef.current = hubPeer;
          isHostRef.current = true;
          setIsHost(true);
          myPeerIdRef.current = roomHubId;

          hubPeer.on('open', () => {
            setConnectionStatus('Комната создана ✓ Ожидание участников...');
          });

          hubPeer.on('call', (call) => {
            call.answer(stream);
            callsRef.current.set(call.peer, call);

            call.on('stream', (remoteStream) => {
              handleRemoteStream(call.peer, remoteStream);
            });

            call.on('close', () => cleanupPeer(call.peer));
            call.on('error', () => cleanupPeer(call.peer));
          });

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

              // Connect to the new peer with audio
              callPeer(conn.peer);
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
              setIsHost(false);
              setConnectionStatus('Переподключение к хосту...');
              // Recreate as client
              hubPeer.destroy();
              const clientPeer = new Peer(`vc-${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, {
                debug: 0,
                config: {
                  iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                  ],
                },
              });
              peerRef.current = clientPeer;
              myPeerIdRef.current = clientPeer.id || '';
              
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

              clientPeer.on('call', (call) => {
                call.answer(stream);
                callsRef.current.set(call.peer, call);
                call.on('stream', (remoteStream) => handleRemoteStream(call.peer, remoteStream));
                call.on('close', () => cleanupPeer(call.peer));
              });

              clientPeer.on('connection', (conn) => {
                dataConnsRef.current.set(conn.peer, conn);
                conn.on('open', () => {
                  const rn = conn.metadata?.nickname || 'Аноним';
                  if (!peersInfoRef.current.has(conn.peer)) {
                    peersInfoRef.current.set(conn.peer, { peerId: conn.peer, nickname: rn, isMuted: false });
                    updatePeersState();
                  }
                });
                conn.on('data', (data: any) => {
                  if (data.type === 'mute-status') {
                    const info = peersInfoRef.current.get(conn.peer);
                    if (info) { info.isMuted = data.isMuted; updatePeersState(); }
                  }
                });
                conn.on('close', () => {
                  dataConnsRef.current.delete(conn.peer);
                  cleanupPeer(conn.peer);
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
    isHost,
    toggleMute,
  };
}
