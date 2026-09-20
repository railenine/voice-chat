import React, { useState, useCallback, useRef } from 'react';
import { useVoiceChat } from '../hooks/useVoiceChat';

interface VoiceChatScreenProps {
  nickname: string;
  roomId: string;
}

export const VoiceChatScreen: React.FC<VoiceChatScreenProps> = ({ nickname, roomId }) => {
  const {
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
    peerVolumes,
    setPeerVolume,
  } = useVoiceChat({
    roomId,
    nickname,
  });

  const prevVolumesRef = useRef<Map<string, number>>(new Map());

  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [myNickname, setMyNickname] = useState(nickname);
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [newNickInput, setNewNickInput] = useState(nickname);

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
    <>
      {/* Jelly Background */}
      <div className="jelly-background">
        <div className="jelly-blob jelly-blob-1"></div>
        <div className="jelly-blob jelly-blob-2"></div>
        <div className="jelly-blob jelly-blob-3"></div>
        <div className="jelly-blob jelly-blob-4"></div>
      </div>

      {/* Content */}
      <div
        className="content-wrapper min-h-screen flex flex-col"
        onClick={() => {
          if (needsAudioUnlock) unlockAudio();
        }}
      >
        {/* Audio Unlock Banner */}
        {needsAudioUnlock && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              unlockAudio();
            }}
            className="cursor-pointer bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 hover:from-amber-500 hover:to-yellow-500 text-white px-4 py-3 text-center text-xs sm:text-sm font-medium shadow-lg flex items-center justify-center gap-2 border-b border-amber-400/40 transition-all z-50 animate-pulse"
          >
            <span className="text-lg">🔊</span>
            <span>
              Браузер приостановил звук собеседников. <strong className="underline">Нажмите сюда</strong>, чтобы включить звук.
            </span>
            <button
              type="button"
              className="ml-2 px-3 py-1 bg-white text-amber-900 rounded-md font-bold text-xs shadow hover:bg-amber-100 transition-all flex-shrink-0"
            >
              Включить
            </button>
          </div>
        )}

        {/* Header */}
        <header className="p-3 sm:p-4 border-b border-white/10 backdrop-blur-sm bg-black/30">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-blue-700 to-blue-900 flex items-center justify-center shadow-lg shadow-blue-900/50 flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-white font-bold text-base sm:text-lg truncate">VoiceChat</h1>
                <p className="text-gray-400 text-xs font-mono truncate">Комната: {roomId}</p>
              </div>
            </div>
            <button
              onClick={() => setShowShare(!showShare)}
              className="px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all text-xs sm:text-sm border border-white/10 flex-shrink-0"
            >
              📤 <span className="hidden sm:inline">Поделиться</span>
            </button>
          </div>
        </header>

        {/* Share Panel */}
        {showShare && (
          <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 p-3 sm:p-4 animate-fade-in">
            <div className="max-w-2xl mx-auto">
              <p className="text-gray-400 text-xs sm:text-sm mb-2">Поделитесь этой ссылкой для приглашения:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-white text-xs sm:text-sm font-mono truncate min-w-0"
                />
                <button
                  onClick={copyRoomId}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
                    copied
                      ? 'bg-green-700 text-white'
                      : 'bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white'
                  }`}
                >
                  {copied ? '✓' : '📋 Копировать'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4">
          <div className="max-w-2xl w-full">
            {/* Connection Status */}
            {!isConnected && !error && (
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-full backdrop-blur-sm">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-yellow-300 text-xs sm:text-sm font-medium">{connectionStatus}</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 bg-red-500/10 border border-red-500/20 rounded-full backdrop-blur-sm">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-red-300 text-xs sm:text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* Participants */}
            <div className="mb-6 sm:mb-8">
              <h2 className="text-gray-400 text-xs sm:text-sm font-medium mb-4 sm:mb-6 text-center uppercase tracking-wider">
                Участники • {peers.length + 1}
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* Current User */}
                <div className={`relative bg-white/5 backdrop-blur-lg rounded-2xl p-4 sm:p-5 border text-center transition-all hover:bg-white/10 animate-bounce-in ${
                  isSpeaking && !isMuted
                    ? 'border-green-400/60 shadow-lg shadow-green-500/20 ring-2 ring-green-400/50'
                    : 'border-white/10'
                }`}>
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full flex items-center justify-center text-xl sm:text-2xl mb-2 sm:mb-3 transition-all ${
                    isMuted 
                      ? 'bg-red-500/20 border-2 border-red-500/50' 
                      : isSpeaking
                      ? 'bg-gradient-to-br from-green-600 to-emerald-800 ring-4 ring-green-400 ring-offset-2 ring-offset-black/50 shadow-lg shadow-green-500/50 scale-105'
                      : 'bg-gradient-to-br from-blue-700 to-blue-900 shadow-lg shadow-blue-900/50'
                  }`}>
                    {isMuted ? '🔇' : isSpeaking ? '🗣️' : '🎤'}
                  </div>
                  {isEditingNick ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const trimmed = newNickInput.trim();
                        if (trimmed) {
                          changeNickname(trimmed);
                          setMyNickname(trimmed);
                          try {
                            localStorage.setItem('voice_chat_nickname', trimmed);
                          } catch (err) {}
                          setIsEditingNick(false);
                        }
                      }}
                      className="flex items-center gap-1 justify-center mt-1"
                    >
                      <input
                        type="text"
                        value={newNickInput}
                        onChange={(e) => setNewNickInput(e.target.value)}
                        maxLength={24}
                        autoFocus
                        className="w-20 sm:w-24 px-1.5 py-0.5 text-xs bg-white/10 border border-blue-400 rounded text-white text-center focus:outline-none"
                      />
                      <button type="submit" className="text-xs text-green-400 hover:text-green-300 font-bold">✓</button>
                      <button type="button" onClick={() => setIsEditingNick(false)} className="text-xs text-red-400 hover:text-red-300 font-bold">✕</button>
                    </form>
                  ) : (
                    <div
                      onClick={() => setIsEditingNick(true)}
                      className="group cursor-pointer flex items-center justify-center gap-1 mt-1 hover:text-blue-300 transition-colors"
                      title="Нажмите, чтобы изменить никнейм"
                    >
                      <p className="text-white font-semibold text-xs sm:text-sm truncate max-w-[110px]">{myNickname}</p>
                      <span className="text-[11px] text-gray-400 opacity-60 group-hover:opacity-100">✏️</span>
                    </div>
                  )}
                  <p className="text-blue-400 text-xs mt-0.5">Вы</p>
                  {isMuted && (
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">Muted</span>
                    </div>
                  )}
                  {!isMuted && isSpeaking && (
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/40 flex items-center gap-1 font-medium animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        Говорит
                      </span>
                    </div>
                  )}
                  {!isMuted && !isSpeaking && isConnected && (
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">Live</span>
                    </div>
                  )}
                </div>

                {/* Other Peers */}
                {peers.map((peer) => (
                  <div key={peer.peerId} className={`relative bg-white/5 backdrop-blur-lg rounded-2xl p-4 sm:p-5 border text-center transition-all hover:bg-white/10 animate-fade-in ${
                    peer.isSpeaking && !peer.isMuted
                      ? 'border-green-400/60 shadow-lg shadow-green-500/20 ring-2 ring-green-400/50'
                      : 'border-white/10'
                  }`}>
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full flex items-center justify-center text-xl sm:text-2xl mb-2 sm:mb-3 transition-all ${
                      peer.isMuted 
                        ? 'bg-red-500/20 border-2 border-red-500/50' 
                        : peer.isSpeaking
                        ? 'bg-gradient-to-br from-green-600 to-emerald-800 ring-4 ring-green-400 ring-offset-2 ring-offset-black/50 shadow-lg shadow-green-500/50 scale-105'
                        : 'bg-gradient-to-br from-blue-700 to-blue-900 shadow-lg shadow-blue-900/50'
                    }`}>
                      {peer.isMuted ? '🔇' : peer.isSpeaking ? '🗣️' : '🎧'}
                    </div>
                    <p className="text-white font-semibold text-xs sm:text-sm truncate">{peer.nickname}</p>
                    <p className="text-gray-500 text-xs mt-1">Участник</p>
                    {peer.isMuted && (
                      <div className="absolute top-2 right-2">
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">Muted</span>
                      </div>
                    )}
                    {!peer.isMuted && peer.isSpeaking && (
                      <div className="absolute top-2 right-2">
                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/40 flex items-center gap-1 font-medium animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                          Говорит
                        </span>
                      </div>
                    )}

                    {/* Individual Volume Control */}
                    <div
                      className="mt-3 pt-2.5 border-t border-white/10 flex flex-col gap-1.5 text-left"
                      onClick={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between text-[11px] text-gray-400 select-none">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const current = peerVolumes[peer.peerId] ?? 100;
                            if (current > 0) {
                              prevVolumesRef.current.set(peer.peerId, current);
                              setPeerVolume(peer.peerId, 0);
                            } else {
                              const prev = prevVolumesRef.current.get(peer.peerId) || 100;
                              setPeerVolume(peer.peerId, prev);
                            }
                          }}
                          className="hover:text-white transition-colors flex items-center gap-1 focus:outline-none p-1 -m-1 touch-manipulation cursor-pointer"
                          title={(peerVolumes[peer.peerId] ?? 100) === 0 ? 'Включить звук' : 'Заглушить'}
                        >
                          <span className="text-xs">
                            {(peerVolumes[peer.peerId] ?? 100) === 0
                              ? '🔇'
                              : (peerVolumes[peer.peerId] ?? 100) < 50
                              ? '🔉'
                              : '🔊'}
                          </span>
                          <span className="text-[10px] sm:text-xs text-gray-300">Громкость</span>
                        </button>
                        <span className={`font-mono text-[10px] sm:text-xs font-semibold ${
                          (peerVolumes[peer.peerId] ?? 100) === 0 ? 'text-red-400' : 'text-blue-300'
                        }`}>
                          {peerVolumes[peer.peerId] ?? 100}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={peerVolumes[peer.peerId] ?? 100}
                        onChange={(e) => setPeerVolume(peer.peerId, Number(e.target.value))}
                        onInput={(e) => setPeerVolume(peer.peerId, Number((e.target as HTMLInputElement).value))}
                        className="w-full h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all touch-none py-1"
                      />
                    </div>
                  </div>
                ))}

                {/* Empty slots */}
                {peers.length === 0 && isConnected && (
                  <div className="bg-white/5 rounded-2xl p-4 sm:p-5 border border-dashed border-white/20 text-center flex items-center justify-center min-h-[140px] sm:min-h-[160px]">
                    <div>
                      <div className="text-2xl sm:text-3xl mb-2">👋</div>
                      <p className="text-gray-500 text-xs sm:text-sm">Ожидание участников...</p>
                      <p className="text-gray-600 text-xs mt-1 hidden sm:block">Поделитесь ссылкой</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Controls */}
        <footer className="p-4 sm:p-6 border-t border-white/10 backdrop-blur-sm bg-black/30">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-4 sm:gap-6">
            <button
              onClick={toggleMute}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                isMuted
                  ? 'bg-red-700 hover:bg-red-800 shadow-lg shadow-red-900/50'
                  : 'bg-white/5 hover:bg-white/10 border-2 border-white/20 hover:border-white/40'
              }`}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              {isMuted ? (
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500/10 hover:bg-red-700 border-2 border-red-500/30 hover:border-red-700 flex items-center justify-center transition-all active:scale-90"
              title="Выйти"
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-red-400 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </button>
          </div>
          <div className="text-center mt-3 sm:mt-4 space-y-1">
            {!isMuted && isConnected && (
              <div className="flex items-center justify-center gap-1 h-5">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      isSpeaking
                        ? 'bg-green-400 sound-wave-bar'
                        : 'bg-blue-500/40'
                    }`}
                    style={{ height: isSpeaking ? undefined : '4px' }}
                  />
                ))}
              </div>
            )}
            <p className={`text-xs sm:text-sm font-medium transition-colors ${
              isMuted ? 'text-red-400' : isSpeaking ? 'text-green-400' : 'text-blue-400'
            }`}>
              {isMuted ? '🔇 Микрофон выключен' : isSpeaking ? '🗣️ Вы говорите...' : '🎤 Микрофон включён'}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};
