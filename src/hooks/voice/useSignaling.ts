import { useState, useRef, useCallback, useEffect, type MutableRefObject } from 'react';
import { getWebSocketUrl } from '../../config';
import { playJoinSound, playLeaveSound } from '../../utils/soundEffects';
import { calculateReconnectDelay } from '../../utils/connectionPolicy';
import type {
  ClientMessage,
  ServerMessage,
  WebRTCSignalData,
  ChatMessage,
  RoomStateMessage,
  UserJoinedMessage,
  UserUpdatedMessage,
  UserMutedMessage,
  UserDeafenedMessage,
} from '../../types/protocol';

export interface UseSignalingProps {
  roomId: string;
  myPeerIdRef: MutableRefObject<string>;
  currentNicknameRef: MutableRefObject<string>;
  isMutedRef: MutableRefObject<boolean>;
  isDeafenedRef: MutableRefObject<boolean>;
  onRoomState: (msg: RoomStateMessage) => void;
  onUserJoined: (msg: UserJoinedMessage) => void;
  onSignal: (from: string, data: WebRTCSignalData) => void;
  onUserUpdated: (msg: UserUpdatedMessage) => void;
  onUserMuted: (msg: UserMutedMessage) => void;
  onUserDeafened: (msg: UserDeafenedMessage) => void;
  onUserSpeaking: (peerId: string, isSpeaking: boolean) => void;
  onUserLeft: (peerId: string) => void;
  onChatMessage: (message: ChatMessage) => void;
  onWsDisconnectCleanup: () => void;
}

export function useSignaling({
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
}: UseSignalingProps) {
  const [isConnected, setIsConnected] = useState(false);
  const isConnectedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Подключение...');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectAttemptsRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const wasConnectedRef = useRef(false);
  const isIntentionalDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<any>(null);
  const reconnectSettleTimerRef = useRef<any>(null);

  // Keep latest callbacks in refs to avoid stale closures in WS event listeners
  const onRoomStateRef = useRef(onRoomState);
  onRoomStateRef.current = onRoomState;
  const onUserJoinedRef = useRef(onUserJoined);
  onUserJoinedRef.current = onUserJoined;
  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;
  const onUserUpdatedRef = useRef(onUserUpdated);
  onUserUpdatedRef.current = onUserUpdated;
  const onUserMutedRef = useRef(onUserMuted);
  onUserMutedRef.current = onUserMuted;
  const onUserDeafenedRef = useRef(onUserDeafened);
  onUserDeafenedRef.current = onUserDeafened;
  const onUserSpeakingRef = useRef(onUserSpeaking);
  onUserSpeakingRef.current = onUserSpeaking;
  const onUserLeftRef = useRef(onUserLeft);
  onUserLeftRef.current = onUserLeft;
  const onChatMessageRef = useRef(onChatMessage);
  onChatMessageRef.current = onChatMessage;
  const onWsDisconnectCleanupRef = useRef(onWsDisconnectCleanup);
  onWsDisconnectCleanupRef.current = onWsDisconnectCleanup;

  const markConnected = useCallback(() => {
    if (reconnectSettleTimerRef.current) {
      clearTimeout(reconnectSettleTimerRef.current);
      reconnectSettleTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    setError(null);
    isConnectedRef.current = true;
    setIsConnected(true);
    setConnectionStatus('В комнате ✓');
  }, []);

  const sendWsMessage = useCallback((msg: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendWsMessageRef = useRef(sendWsMessage);
  sendWsMessageRef.current = sendWsMessage;

  const connectWs = useCallback(() => {
    if (isIntentionalDisconnectRef.current) return;

    setConnectionStatus(wasConnectedRef.current ? 'Переподключение...' : 'Подключение к серверу...');
    const wsUrl = getWebSocketUrl();

    console.log(`[WS] Connecting to: ${wsUrl}`);
    try {
      if (wsRef.current) {
        try {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onerror = null;
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch (e) {}
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected successfully');
        setError(null);
        setConnectionStatus(wasConnectedRef.current ? 'Переподключение...' : 'Вход в комнату...');

        // Join room message (include current mute/deafen state)
        ws.send(
          JSON.stringify({
            type: 'join',
            roomId,
            peerId: myPeerIdRef.current,
            nickname: currentNicknameRef.current,
            isMuted: isMutedRef.current,
            isDeafened: isDeafenedRef.current,
          })
        );

        // Sync mute/deafen if user toggled before WS was open
        if (isMutedRef.current) {
          ws.send(JSON.stringify({ type: 'update-mute', isMuted: true }));
        }
        if (isDeafenedRef.current) {
          ws.send(JSON.stringify({ type: 'update-deafen', isDeafened: true }));
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data as string) as ServerMessage;
        } catch (e) {
          return;
        }

        if (!msg || typeof msg !== 'object' || !('type' in msg)) {
          return;
        }

        const { type } = msg;

        // Initial room state: list of existing peers
        if (type === 'room-state') {
          console.log(`[WS] Received room-state with ${msg.peers?.length || 0} peers`);
          playJoinSound();
          wasConnectedRef.current = true;

          onRoomStateRef.current(msg);

          const peerList = Array.isArray(msg.peers) ? msg.peers : [];
          if (peerList.length > 0) {
            setConnectionStatus('Восстановление звука...');
            if (reconnectSettleTimerRef.current) clearTimeout(reconnectSettleTimerRef.current);
            reconnectSettleTimerRef.current = setTimeout(() => {
              console.log('[WebRTC] Reconnect settle timer expired, marking connection ready');
              markConnected();
            }, 3500);
          } else {
            // User is alone in the room, no WebRTC connections to wait for!
            markConnected();
          }
        }

        // Another peer joined the room
        else if (type === 'user-joined') {
          console.log(`[WS] Peer joined: ${msg.peer.peerId} (${msg.peer.nickname})`);
          playJoinSound();
          onUserJoinedRef.current(msg);
        }

        // WebRTC signaling message
        else if (type === 'signal') {
          onSignalRef.current(msg.from, msg.data);
        }

        // Peer updated nickname
        else if (type === 'user-updated') {
          onUserUpdatedRef.current(msg);
        }

        // Peer updated mute status
        else if (type === 'user-muted') {
          onUserMutedRef.current(msg);
        }

        // Peer updated deafen status
        else if (type === 'user-deafened') {
          onUserDeafenedRef.current(msg);
        }

        // Peer speaking status
        else if (type === 'user-speaking') {
          onUserSpeakingRef.current(msg.peerId, msg.isSpeaking);
        }

        // Peer left the room
        else if (type === 'user-left') {
          console.log(`[WS] Peer left: ${msg.peerId}`);
          playLeaveSound();
          onUserLeftRef.current(msg.peerId);
        }

        // In-room chat message
        else if (type === 'chat-message') {
          if (msg.message) {
            onChatMessageRef.current(msg.message);
          }
        }

        // Server-sent error message
        else if (type === 'error') {
          const isRoomFull = msg.code === 'room_full' || (msg as any).error === 'room_full';
          if (isRoomFull) {
            // Prevent automated reconnection flood against full room
            isIntentionalDisconnectRef.current = true;
          }
          const codeSuffix = msg.code ? ` (${msg.code})` : '';
          console.warn(`[WS] Server error${codeSuffix}:`, msg.message);
          setError(msg.message || `Ошибка сервера${codeSuffix}`);
        }
      };

      ws.onclose = () => {
        console.warn('[WS] WebSocket disconnected');
        isConnectedRef.current = false;
        setIsConnected(false);
        if (reconnectSettleTimerRef.current) {
          clearTimeout(reconnectSettleTimerRef.current);
          reconnectSettleTimerRef.current = null;
        }
        if (wasConnectedRef.current) {
          wasConnectedRef.current = false;
          playLeaveSound();
        }
        if (!isIntentionalDisconnectRef.current) {
          onWsDisconnectCleanupRef.current();

          reconnectAttemptsRef.current += 1;
          const attempts = reconnectAttemptsRef.current;
          setReconnectAttempts(attempts);

          if (attempts >= 5) {
            setError(
              'Не удалось подключиться к серверу сигнализации. Проверьте интернет или повторите попытку.'
            );
            setConnectionStatus('Не удалось подключиться');
          } else {
            setConnectionStatus(
              attempts > 1 ? `Переподключение (${attempts})...` : 'Переподключение...'
            );
          }

          const delay = calculateReconnectDelay(attempts);
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (!isIntentionalDisconnectRef.current) {
              console.log(`[WS] Reconnecting WebSocket (attempt ${attempts})...`);
              connectWs();
            }
          }, delay);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] WebSocket error:', err);
        if (reconnectAttemptsRef.current === 0 || reconnectAttemptsRef.current >= 4) {
          setError('Ошибка подключения к серверу сигнализации.');
        }
      };
    } catch (wsErr) {
      console.warn('[WS] Failed to connect:', wsErr);
      if (!isIntentionalDisconnectRef.current) {
        setConnectionStatus('Переподключение...');
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(connectWs, 2500);
      }
    }
  }, [roomId, myPeerIdRef, currentNicknameRef, isMutedRef, isDeafenedRef, markConnected]);

  const disconnectWs = useCallback(() => {
    isIntentionalDisconnectRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (reconnectSettleTimerRef.current) {
      clearTimeout(reconnectSettleTimerRef.current);
      reconnectSettleTimerRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'leave' }));
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
  }, []);

  const resetSignaling = useCallback(() => {
    setError(null);
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    setConnectionStatus('Подключение к серверу...');
    isIntentionalDisconnectRef.current = false;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (reconnectSettleTimerRef.current) {
      clearTimeout(reconnectSettleTimerRef.current);
      reconnectSettleTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWs();
    };
  }, [disconnectWs]);

  return {
    isConnected,
    isConnectedRef,
    error,
    setError,
    connectionStatus,
    setConnectionStatus,
    reconnectAttempts,
    setReconnectAttempts,
    reconnectAttemptsRef,
    wsRef,
    sendWsMessage,
    sendWsMessageRef,
    connectWs,
    disconnectWs,
    markConnected,
    resetSignaling,
  };
}
