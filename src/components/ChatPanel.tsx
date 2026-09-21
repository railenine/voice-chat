import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from '../hooks/useVoiceChat';

interface ChatPanelProps {
  roomId: string;
  messages: ChatMessage[];
  myPeerId: string;
  onSendMessage: (text: string) => void;
  className?: string;
  showHeader?: boolean;
  onOpenMobileDrawer?: () => void;
  participantCount?: number;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  roomId,
  messages,
  myPeerId,
  onSendMessage,
  className = '',
  showHeader = true,
  onOpenMobileDrawer,
  participantCount,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Check if user is scrolled near bottom
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 60; // px from bottom
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  };

  // Scroll to bottom when messages change if user was already at bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
    isAtBottomRef.current = true;
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex flex-col h-full bg-slate-950/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden ${className}`}>
      {/* Header (optional, mainly for desktop or top bar) */}
      {showHeader && (
        <div className="p-3.5 px-4 sm:px-5 border-b border-white/10 flex items-center justify-between bg-white/[0.03] backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            {onOpenMobileDrawer && (
              <button
                type="button"
                onClick={onOpenMobileDrawer}
                className="lg:hidden p-1.5 -ml-1 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1.5"
                title="Список участников"
              >
                <span className="text-lg">☰</span>
                {typeof participantCount === 'number' && (
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-mono font-medium border border-blue-500/30">
                    👥 {participantCount}
                  </span>
                )}
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 flex-shrink-0">
              💬
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate flex items-center gap-2">
                <span>Чат комнаты</span>
                <span className="text-[11px] font-mono text-gray-400 font-normal">#{roomId}</span>
              </h2>
              <p className="text-[11px] text-gray-400 truncate">
                {messages.length === 0
                  ? 'Сообщения видны только участникам'
                  : `${messages.length} ${messages.length === 1 ? 'сообщение' : messages.length < 5 ? 'сообщения' : 'сообщений'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              P2P & RAM Only
            </span>
          </div>
        </div>
      )}

      {/* Message List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-h-0 select-text"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none animate-fade-in text-gray-400">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-3 text-gray-300 shadow-inner">
              💬
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-white mb-1">
              В этой комнате пока нет сообщений
            </h3>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed mb-3">
              Отправьте первое сообщение! Переписка хранится исключительно в оперативной памяти и будет полностью удалена, как только все участники покинут комнату.
            </p>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
              <span>🔒</span> Без истории и без логов на сервере
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.peerId === myPeerId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group animate-fade-in`}
              >
                <div className="flex items-baseline gap-1.5 mb-1 px-1">
                  <span
                    className={`text-[11px] font-semibold ${
                      isMe ? 'text-blue-300' : 'text-amber-300'
                    }`}
                  >
                    {isMe ? 'Вы' : msg.nickname}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm break-words whitespace-pre-wrap leading-relaxed shadow-md ${
                    isMe
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm border border-blue-400/30'
                      : 'bg-white/10 hover:bg-white/[0.13] text-gray-100 rounded-tl-sm border border-white/10'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 sm:p-3 bg-black/40 border-t border-white/10 flex items-center gap-2 flex-shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={1000}
          placeholder={`Сообщение в #${roomId}... (Enter для отправки)`}
          className="flex-1 bg-white/5 hover:bg-white/[0.08] focus:bg-white/10 border border-white/10 focus:border-blue-500/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="px-3.5 sm:px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 active:scale-95 flex-shrink-0"
          title="Отправить сообщение"
        >
          <span>Отправить</span>
          <span className="text-xs">➤</span>
        </button>
      </form>
    </div>
  );
};
