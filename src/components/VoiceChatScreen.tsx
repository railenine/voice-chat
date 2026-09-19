import React, { useState, useCallback } from 'react';
import { useVoiceChat } from '../hooks/useVoiceChat';

interface VoiceChatScreenProps {
  nickname: string;
  roomId: string;
}

export const VoiceChatScreen: React.FC<VoiceChatScreenProps> = ({ nickname, roomId }) => {
  const { isConnected, isMuted, peers, error, connectionStatus, toggleMute } = useVoiceChat({
    roomId,
    nickname,
  });

  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const copyRoomId = useCallback(() => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId]);

  const shareLink = `${window.location.origin}?room=${roomId}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">VoiceChat</h1>
              <p className="text-gray-400 text-xs font-mono">Комната: {roomId}</p>
            </div>
          </div>
          <button
            onClick={() => setShowShare(!showShare)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm border border-white/10"
          >
            📤 Поделиться
          </button>
        </div>
      </header>

      {/* Share Panel */}
      {showShare && (
        <div className="bg-white/5 border-b border-white/10 p-4 animate-in">
          <div className="max-w-2xl mx-auto">
            <p className="text-gray-400 text-sm mb-2">Поделитесь этой ссылкой для приглашения:</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono truncate"
              />
              <button
                onClick={copyRoomId}
                className={`px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
              >
                {copied ? '✓ Готово' : '📋 Копировать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {/* Connection Status */}
          {!isConnected && !error && (
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-yellow-300 text-sm font-medium">{connectionStatus}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-red-500/10 border border-red-500/20 rounded-full">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-red-300 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="mb-8">
            <h2 className="text-gray-400 text-sm font-medium mb-6 text-center uppercase tracking-wider">
              Участники • {peers.length + 1}
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Current User */}
              <div className="relative bg-white/5 backdrop-blur-lg rounded-2xl p-5 border border-white/10 text-center transition-all hover:bg-white/10 animate-bounce-in">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl mb-3 transition-all ${
                  isMuted 
                    ? 'bg-red-500/20 border-2 border-red-500/50' 
                    : 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30'
                }`}>
                  {isMuted ? '🔇' : '🎤'}
                </div>
                <p className="text-white font-semibold text-sm truncate">{nickname}</p>
                <p className="text-purple-400 text-xs mt-1">Вы</p>
                {isMuted && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">Muted</span>
                  </div>
                )}
                {!isMuted && isConnected && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">Live</span>
                  </div>
                )}
              </div>

              {/* Other Peers */}
              {peers.map((peer) => (
                <div key={peer.peerId} className="relative bg-white/5 backdrop-blur-lg rounded-2xl p-5 border border-white/10 text-center transition-all hover:bg-white/10 animate-fade-in">
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl mb-3 transition-all ${
                    peer.isMuted 
                      ? 'bg-red-500/20 border-2 border-red-500/50' 
                      : 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30'
                  }`}>
                    {peer.isMuted ? '🔇' : '🎧'}
                  </div>
                  <p className="text-white font-semibold text-sm truncate">{peer.nickname}</p>
                  <p className="text-gray-500 text-xs mt-1">Участник</p>
                  {peer.isMuted && (
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">Muted</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Empty slots */}
              {peers.length === 0 && isConnected && (
                <div className="bg-white/5 rounded-2xl p-5 border border-dashed border-white/20 text-center flex items-center justify-center min-h-[160px]">
                  <div>
                    <div className="text-3xl mb-2">👋</div>
                    <p className="text-gray-500 text-sm">Ожидание участников...</p>
                    <p className="text-gray-600 text-xs mt-1">Поделитесь ссылкой</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Controls */}
      <footer className="p-6 border-t border-white/10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-6">
          <button
            onClick={toggleMute}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              isMuted
                ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/40'
                : 'bg-white/10 hover:bg-white/20 border-2 border-white/20 hover:border-white/40'
            }`}
            title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            {isMuted ? (
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={() => {
              if (confirm('Выйти из голосового чата?')) {
                window.location.href = window.location.origin;
              }
            }}
            className="w-16 h-16 rounded-full bg-red-500/20 hover:bg-red-500 border-2 border-red-500/30 hover:border-red-500 flex items-center justify-center transition-all active:scale-90"
            title="Выйти"
          >
            <svg className="w-7 h-7 text-red-400 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>
        <div className="text-center mt-4 space-y-2">
          {!isMuted && isConnected && (
            <div className="flex items-center justify-center gap-1 h-5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-green-400 rounded-full sound-wave-bar"
                  style={{ height: '4px' }}
                />
              ))}
            </div>
          )}
          <p className={`text-sm font-medium ${isMuted ? 'text-red-400' : 'text-green-400'}`}>
            {isMuted ? '🔇 Микрофон выключен' : '🎤 Микрофон включён'}
          </p>
          <p className="text-gray-500 text-xs">
            {peers.length === 0 ? 'Вы единственный участник' : `${peers.length} участник(ов) в комнате`}
          </p>
        </div>
      </footer>
    </div>
  );
};
