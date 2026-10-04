import { useState, useCallback } from 'react';
import type { ChatMessage, ClientMessage } from '../../types/protocol';

interface UseRoomChatOptions {
  sendWsMessage: (msg: ClientMessage) => void;
}

export function useRoomChat({ sendWsMessage }: UseRoomChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendChatMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      sendWsMessage({
        type: 'chat-message',
        text: trimmed,
      });
    },
    [sendWsMessage]
  );

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const setInitialMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(Array.isArray(msgs) ? msgs : []);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    setMessages,
    sendChatMessage,
    addMessage,
    setInitialMessages,
    clearMessages,
  };
}
