import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { useHotkey, isHotkeyMatch, MOUSE_HOTKEY_OPTIONS } from '../hooks/useHotkey';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { AudioDeviceSettings } from './AudioDeviceSettings';
import { ChatPanel } from './ChatPanel';
import { getShareUrl, isTauri } from '../config';
import { playLeaveSound } from '../utils/soundEffects';

interface VoiceChatScreenProps {
  nickname: string;
  roomId: string;
  deviceState?: ReturnType<typeof useAudioDevices>;
}

export const VoiceChatScreen: React.FC<VoiceChatScreenProps> = ({
  nickname,
  roomId,
  deviceState,
}) => {
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
    isNoiseSuppression,
    toggleNoiseSuppression,
    messages,
    sendChatMessage,
    myPeerId,
  } = useVoiceChat({
    roomId,
    nickname,
    audioInputDeviceId: deviceState?.selectedInput,
    audioOutputDeviceId: deviceState?.selectedOutput,
  });

  const {
    hotkey,
    isRecording,
    isDesktop,
    startRecording,
    cancelRecording,
    resetHotkey,
    updateHotkey,
  } = useHotkey({
    onTrigger: toggleMute,
    enabled: true,
  });

  const [showHotkeyModal, setShowHotkeyModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const isPipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  const togglePip = useCallback(async () => {
    if (!isPipSupported) return;

    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }

    try {
      const win = await (window as any).documentPictureInPicture.requestWindow({
        width: 240,
        height: 160,
      });

      // Copy document stylesheets to PiP window
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
          const style = win.document.createElement('style');
          style.textContent = cssRules;
          win.document.head.appendChild(style);
        } catch (e) {
          const link = win.document.createElement('link');
          link.rel = 'stylesheet';
          link.type = styleSheet.type;
          link.media = styleSheet.media;
          link.href = (styleSheet as any).href;
          win.document.head.appendChild(link);
        }
      });

      win.document.title = `VoiceChat — Оверлей`;
      win.document.body.className = 'bg-slate-900 text-white flex flex-col items-center justify-center m-0 p-3 h-screen select-none font-sans overflow-hidden';

      win.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      setPipWindow(win);
    } catch (err) {
      console.error('Failed to open PiP window:', err);
    }
  }, [isPipSupported, pipWindow]);

  // Handle hotkey inside PiP window when focused
  useEffect(() => {
    if (!pipWindow) return;

    const handlePipKeyDown = (e: KeyboardEvent) => {
      if (isHotkeyMatch(e, hotkey)) {
        e.preventDefault();
        toggleMute();
      }
    };

    pipWindow.addEventListener('keydown', handlePipKeyDown);
    return () => {
      pipWindow.removeEventListener('keydown', handlePipKeyDown);
    };
  }, [pipWindow, hotkey, toggleMute]);

  const prevVolumesRef = useRef<Map<string, number>>(new Map());

  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [myNickname, setMyNickname] = useState(nickname);
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [newNickInput, setNewNickInput] = useState(nickname);

  const copyRoomId = useCallback(() => {
    const url = getShareUrl(roomId);
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

  const shareLink = getShareUrl(roomId);

  // Active speakers list for Mobile Banner
  const activeSpeakers = useMemo(() => {
    const speakers: string[] = [];
    if (isSpeaking && !isMuted) {
      speakers.push(myNickname || 'Вы');
    }
    peers.forEach((p) => {
      if (p.isSpeaking && !p.isMuted) {
        speakers.push(p.nickname);
      }
    });
    return speakers;
  }, [isSpeaking, isMuted, myNickname, peers]);

  const handleLeave = () => {
    if (confirm('Выйти из голосового чата?')) {
      playLeaveSound();
      setTimeout(() => {
        if (isTauri()) {
          window.history.replaceState({}, '', window.location.pathname);
          window.location.reload();
        } else {
          window.location.href = window.location.origin;
        }
      }, 200);
    }
  };

  // Participant list component (reused in desktop sidebar and mobile drawer)
  const renderParticipantList = () => (
    <div className="space-y-2.5">
      {/* Current User Card */}
      <div className={`p-3 rounded-xl border transition-all bg-white/5 backdrop-blur-md ${
        isSpeaking && !isMuted
          ? 'border-green-400/60 shadow-md shadow-green-500/20 ring-1 ring-green-400/50'
          : 'border-white/10 hover:border-white/20'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 transition-all ${
            isMuted
              ? 'bg-red-500/20 border border-red-500/50'
              : isSpeaking
              ? 'bg-gradient-to-br from-green-600 to-emerald-800 ring-2 ring-green-400 shadow-md shadow-green-500/50 scale-105'
              : 'bg-gradient-to-br from-blue-700 to-blue-900 shadow-md'
          }`}>
            {isMuted ? '🔇' : isSpeaking ? '🗣️' : '🎤'}
          </div>

          <div className="flex-1 min-w-0">
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
                className="flex items-center gap-1 w-full"
              >
                <input
                  type="text"
                  value={newNickInput}
                  onChange={(e) => setNewNickInput(e.target.value)}
                  maxLength={24}
                  autoFocus
                  className="flex-1 min-w-0 px-2 py-0.5 text-xs bg-white/10 border border-blue-400 rounded text-white focus:outline-none"
                />
                <button type="submit" className="text-xs text-green-400 hover:text-green-300 font-bold px-1">✓</button>
                <button type="button" onClick={() => setIsEditingNick(false)} className="text-xs text-red-400 hover:text-red-300 font-bold px-1">✕</button>
              </form>
            ) : (
              <div
                onClick={() => setIsEditingNick(true)}
                className="group cursor-pointer flex items-center gap-1.5 hover:text-blue-300 transition-colors"
                title="Нажмите, чтобы изменить никнейм"
              >
                <span className="text-white font-semibold text-xs sm:text-sm truncate max-w-[120px]">
                  {myNickname}
                </span>
                <span className="text-[10px] text-gray-400 opacity-60 group-hover:opacity-100 flex-shrink-0">✏️</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              {isMuted ? (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded border border-red-500/30 font-medium">
                  Muted
                </span>
              ) : isSpeaking ? (
                <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.2 rounded border border-green-500/40 font-medium flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Говорит
                </span>
              ) : (
                <span className="text-[11px] text-blue-400 font-medium">Вы</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Remote Peers Cards */}
      {peers.map((peer) => {
        const vol = peerVolumes[peer.peerId] ?? 100;
        return (
          <div
            key={peer.peerId}
            className={`p-3 rounded-xl border transition-all bg-white/5 backdrop-blur-md ${
              peer.isSpeaking && !peer.isMuted
                ? 'border-green-400/60 shadow-md shadow-green-500/20 ring-1 ring-green-400/50'
                : 'border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 transition-all ${
                peer.isMuted
                  ? 'bg-red-500/20 border border-red-500/50'
                  : peer.isSpeaking
                  ? 'bg-gradient-to-br from-green-600 to-emerald-800 ring-2 ring-green-400 shadow-md shadow-green-500/50 scale-105'
                  : 'bg-gradient-to-br from-blue-700 to-blue-900 shadow-md'
              }`}>
                {peer.isMuted ? '🔇' : peer.isSpeaking ? '🗣️' : '🎧'}
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-white font-semibold text-xs sm:text-sm truncate block">
                  {peer.nickname}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {peer.isMuted ? (
                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded border border-red-500/30 font-medium">
                      Muted
                    </span>
                  ) : peer.isSpeaking ? (
                    <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.2 rounded border border-green-500/40 font-medium flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                      Говорит
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400">Участник</span>
                  )}
                </div>
              </div>
            </div>

            {/* Peer Volume Slider */}
            <div
              className="mt-2.5 pt-2 border-t border-white/10 flex flex-col gap-1 select-none"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <button
                  type="button"
                  onClick={() => {
                    const current = peerVolumes[peer.peerId] ?? 100;
                    if (current > 0) {
                      prevVolumesRef.current.set(peer.peerId, current);
                      setPeerVolume(peer.peerId, 0);
                    } else {
                      const prev = prevVolumesRef.current.get(peer.peerId) || 100;
                      setPeerVolume(peer.peerId, prev);
                    }
                  }}
                  className="hover:text-white transition-colors flex items-center gap-1 text-[11px] p-0.5 -m-0.5"
                  title={vol === 0 ? 'Включить звук' : 'Заглушить'}
                >
                  <span>{vol === 0 ? '🔇' : vol < 50 ? '🔉' : '🔊'}</span>
                  <span>Громкость</span>
                </button>
                <span className={`font-mono font-semibold text-[11px] ${
                  vol === 0
                    ? 'text-red-400'
                    : vol > 100
                    ? 'text-emerald-400 font-bold'
                    : 'text-blue-300'
                }`}>
                  {vol}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={vol}
                onChange={(e) => setPeerVolume(peer.peerId, Number(e.target.value))}
                onInput={(e) => setPeerVolume(peer.peerId, Number((e.target as HTMLInputElement).value))}
                title={`Громкость: ${vol}%${vol > 100 ? ' (Усиление)' : ''}`}
                className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-all ${
                  vol > 100
                    ? 'bg-emerald-500/25 accent-emerald-400'
                    : 'bg-white/15 accent-blue-500'
                }`}
              />
            </div>
          </div>
        );
      })}

      {/* Empty slot */}
      {peers.length === 0 && isConnected && (
        <div
          onClick={copyRoomId}
          role="button"
          tabIndex={0}
          title="Нажмите, чтобы скопировать ссылку на комнату"
          className="bg-white/5 hover:bg-white/10 active:scale-[0.98] cursor-pointer transition-all rounded-xl p-3.5 border border-dashed border-white/20 hover:border-white/30 text-center select-none"
        >
          <div className="text-xl mb-1">{copied ? '📋' : '👋'}</div>
          <p className={`text-xs font-medium ${copied ? 'text-green-400 font-semibold' : 'text-gray-400'}`}>
            {copied ? '✓ Ссылка скопирована!' : 'Ожидание участников...'}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {copied ? 'Отправьте её друзьям' : 'Поделитесь ссылкой на комнату'}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Jelly Background */}
      <div className="jelly-background">
        <div className="jelly-blob jelly-blob-1"></div>
        <div className="jelly-blob jelly-blob-2"></div>
        <div className="jelly-blob jelly-blob-3"></div>
        <div className="jelly-blob jelly-blob-4"></div>
      </div>

      {/* Root Layout */}
      <div
        className="content-wrapper h-full w-full flex-1 flex flex-col overflow-hidden text-white font-sans"
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
            className="cursor-pointer bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 hover:from-amber-500 hover:to-yellow-500 text-white px-3 sm:px-4 py-2 text-center text-xs sm:text-sm font-medium shadow-lg flex items-center justify-center gap-2 border-b border-amber-400/40 transition-all z-50 animate-pulse flex-shrink-0"
          >
            <span className="text-base flex-shrink-0">🔊</span>
            <span>
              Браузер приостановил звук собеседников. <strong className="underline">Нажмите сюда</strong>, чтобы включить звук.
            </span>
            <button
              type="button"
              className="px-2.5 py-0.5 bg-white text-amber-900 rounded-md font-bold text-xs shadow hover:bg-amber-100 transition-all flex-shrink-0 ml-1"
            >
              Включить
            </button>
          </div>
        )}

        {/* Global Share Panel (if opened) */}
        {showShare && (
          <div className="bg-black/40 backdrop-blur-md border-b border-white/10 p-2.5 sm:p-3 animate-fade-in flex-shrink-0 z-30">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-2">
              <span className="text-xs text-gray-300 flex-shrink-0">Ссылка на комнату:</span>
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 w-full py-1.5 px-3 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono truncate"
              />
              <button
                onClick={copyRoomId}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs flex items-center gap-1 flex-shrink-0 ${
                  copied
                    ? 'bg-green-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                <span>{copied ? '✓' : '📋'}</span>
                <span>{copied ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Mobile Header (< 1024px) */}
        <header className="lg:hidden p-2.5 sm:p-3 border-b border-white/10 backdrop-blur-sm bg-black/40 flex items-center justify-between gap-2 flex-shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setShowMobileDrawer(true)}
              className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-1.5 text-xs text-white flex-shrink-0 active:scale-95 transition-all"
              title="Список участников и настройки"
            >
              <span className="text-base">☰</span>
              <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-mono text-[11px] font-bold border border-blue-500/30">
                👥 {peers.length + 1}
              </span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white truncate">VoiceChat</span>
                <span className="text-[10px] text-gray-400 font-mono">#{roomId}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {deviceState && (
              <button
                onClick={() => setShowAudioModal(true)}
                className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 text-xs flex-shrink-0"
                title="Устройства"
              >
                🎧
              </button>
            )}
            <button
              onClick={() => setShowHotkeyModal(true)}
              className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 text-xs flex-shrink-0"
              title="Горячая клавиша"
            >
              ⌨️
            </button>
            <button
              onClick={() => setShowShare(!showShare)}
              className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 text-xs flex-shrink-0"
              title="Поделиться"
            >
              📤
            </button>
          </div>
        </header>

        {/* Mobile Active Speakers Indicator Bar (< 1024px) */}
        <div className="lg:hidden bg-slate-900/60 border-b border-white/5 px-3 py-1.5 flex items-center justify-between text-xs flex-shrink-0 min-h-[34px]">
          <div className="flex items-center gap-2 overflow-hidden">
            {activeSpeakers.length > 0 ? (
              <div className="flex items-center gap-1.5 text-green-400 animate-pulse truncate font-medium">
                <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"></span>
                <span className="truncate">
                  🗣️ {activeSpeakers.join(', ')} {activeSpeakers.length === 1 ? 'говорит...' : 'говорят...'}
                </span>
              </div>
            ) : (
              <span className="text-gray-500 text-[11px] truncate">
                {!isConnected ? connectionStatus : 'Тишина в комнате'}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-500 font-mono ml-2 flex-shrink-0">
            {peers.length + 1} в сети
          </span>
        </div>

        {/* Desktop & Main Content Split (Option 3 Layout) */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* DESKTOP SIDEBAR (>= 1024px) */}
          <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-r border-white/10 bg-slate-950/40 backdrop-blur-md flex-shrink-0 select-none">
            {/* Sidebar Top: Logo & Room info */}
            <div className="p-3.5 px-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-700 to-blue-900 flex items-center justify-center shadow-md flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h1 className="text-white font-bold text-sm truncate">VoiceChat</h1>
                  <p className="text-gray-400 text-xs font-mono truncate">#{roomId}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {deviceState && (
                  <button
                    onClick={() => setShowAudioModal(true)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Настройка звуковых устройств"
                  >
                    🎧
                  </button>
                )}
                <button
                  onClick={() => setShowHotkeyModal(true)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title={`Горячая клавиша: ${hotkey.label}`}
                >
                  ⌨️
                </button>
                <button
                  onClick={() => setShowShare(!showShare)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Поделиться ссылкой на комнату"
                >
                  📤
                </button>
              </div>
            </div>

            {/* Connection / Error Banner in Sidebar */}
            {(!isConnected || error) && (
              <div className="p-3 border-b border-white/10 bg-white/[0.02]">
                {error ? (
                  <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">
                    {error}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-300 text-xs">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                    <span>{connectionStatus}</span>
                  </div>
                )}
              </div>
            )}

            {/* Scrollable Participants Section */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Участники ({peers.length + 1})
                </span>
                <span className="text-[10px] text-blue-400 font-mono">
                  {peers.filter(p => !p.isMuted).length + (!isMuted ? 1 : 0)} с микрофоном
                </span>
              </div>

              {renderParticipantList()}
            </div>

            {/* Desktop Sidebar Bottom Dock: Mic, Noise Suppression, Status */}
            <div className="p-3.5 border-t border-white/10 bg-black/40 backdrop-blur-md space-y-2.5 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                {/* Mute toggle button */}
                <button
                  onClick={toggleMute}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md ${
                    isMuted
                      ? 'bg-red-700 hover:bg-red-800 text-white shadow-red-900/40'
                      : 'bg-white/10 hover:bg-white/15 border border-white/20 text-white'
                  }`}
                  title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                >
                  <span className="text-base">{isMuted ? '🔇' : '🎤'}</span>
                  <span>{isMuted ? 'Микрофон ВЫКЛ' : 'Микрофон ВКЛ'}</span>
                </button>

                {/* RNNoise Toggle */}
                <button
                  onClick={toggleNoiseSuppression}
                  className={`p-2.5 rounded-xl border transition-all active:scale-95 flex-shrink-0 ${
                    isNoiseSuppression
                      ? 'bg-white/10 border-white/30 text-white hover:bg-white/15'
                      : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
                  }`}
                  title={isNoiseSuppression ? 'Шумоподавление: ВКЛ' : 'Шумоподавление: ВЫКЛ'}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z" />
                  </svg>
                </button>

                {/* Leave Button */}
                <button
                  onClick={handleLeave}
                  className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-700 border border-red-500/30 hover:border-red-700 text-red-400 hover:text-white transition-all active:scale-95 flex-shrink-0"
                  title="Покинуть комнату"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                  </svg>
                </button>
              </div>

              {/* Status Wave & Hotkey note */}
              <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                <div className="flex items-center gap-1.5">
                  {!isMuted && isConnected && (
                    <div className="flex items-center gap-0.5 h-3">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-0.5 rounded-full transition-all duration-150 ${
                            isSpeaking ? 'bg-green-400 sound-wave-bar' : 'bg-blue-500/40'
                          }`}
                          style={{ height: isSpeaking ? undefined : '3px' }}
                        />
                      ))}
                    </div>
                  )}
                  <span className={isMuted ? 'text-red-400' : isSpeaking ? 'text-green-400' : 'text-blue-400'}>
                    {isMuted ? 'Заглушен' : isSpeaking ? 'Говорит...' : 'В эфире'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHotkeyModal(true)}
                  className="font-mono text-[10px] bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded text-gray-300 hover:text-white transition-colors border border-white/10"
                >
                  [{hotkey.label}]
                </button>
              </div>
            </div>
          </aside>

          {/* MAIN CHAT AREA (Full height, center on desktop, full screen on mobile) */}
          <main className="flex-1 flex flex-col min-w-0 p-2 sm:p-4 lg:p-5 overflow-hidden">
            <ChatPanel
              roomId={roomId}
              messages={messages}
              myPeerId={myPeerId}
              onSendMessage={sendChatMessage}
              onOpenMobileDrawer={() => setShowMobileDrawer(true)}
              participantCount={peers.length + 1}
              className="flex-1 min-h-0"
            />
          </main>
        </div>

        {/* Mobile Sticky Bottom Controls (< 1024px) */}
        <div className="lg:hidden p-2.5 sm:p-3 bg-black/50 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 flex-shrink-0 z-20">
          <button
            onClick={toggleMute}
            className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md ${
              isMuted
                ? 'bg-red-700 hover:bg-red-800 text-white shadow-red-900/40'
                : 'bg-white/10 hover:bg-white/15 border border-white/20 text-white'
            }`}
          >
            <span className="text-base">{isMuted ? '🔇' : '🎤'}</span>
            <span>{isMuted ? 'Микрофон ВЫКЛ' : 'Микрофон ВКЛ'}</span>
          </button>

          <button
            onClick={toggleNoiseSuppression}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 flex-shrink-0 ${
              isNoiseSuppression
                ? 'bg-white/10 border-white/30 text-white hover:bg-white/15'
                : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
            }`}
            title={isNoiseSuppression ? 'Шумоподавление: ВКЛ' : 'Шумоподавление: ВЫКЛ'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z" />
            </svg>
          </button>

          <button
            onClick={handleLeave}
            className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-700 border border-red-500/30 hover:border-red-700 text-red-400 hover:text-white transition-all active:scale-95 flex-shrink-0"
            title="Покинуть комнату"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>

        {/* Mobile Slide-Over Drawer for Participants (< 1024px) */}
        {showMobileDrawer && (
          <div
            className="lg:hidden fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowMobileDrawer(false)}
          >
            <div
              className="w-4/5 max-w-sm h-full bg-slate-900/95 border-r border-white/20 p-4 flex flex-col shadow-2xl space-y-4 animate-slide-in select-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">👥</span>
                  <h3 className="font-bold text-sm sm:text-base">Участники ({peers.length + 1})</h3>
                </div>
                <button
                  onClick={() => setShowMobileDrawer(false)}
                  className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
                {renderParticipantList()}
              </div>

              {/* Drawer Quick Actions */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <button
                  onClick={() => {
                    setShowMobileDrawer(false);
                    setShowShare(true);
                  }}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs flex items-center justify-center gap-2"
                >
                  <span>📤</span>
                  <span>Поделиться ссылкой на комнату</span>
                </button>
                {deviceState && (
                  <button
                    onClick={() => {
                      setShowMobileDrawer(false);
                      setShowAudioModal(true);
                    }}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs flex items-center justify-center gap-2"
                  >
                    <span>🎧</span>
                    <span>Настройка звуковых устройств</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMobileDrawer(false);
                    setShowHotkeyModal(true);
                  }}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs flex items-center justify-center gap-2"
                >
                  <span>⌨️</span>
                  <span>Горячая клавиша [{hotkey.label}]</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audio Devices Modal */}
      {showAudioModal && deviceState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAudioModal(false)}
        >
          <div
            className="bg-slate-900/95 border border-white/20 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎧</span>
                <h3 className="font-bold text-base sm:text-lg">Настройка звуковых устройств</h3>
              </div>
              <button
                onClick={() => setShowAudioModal(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none p-1"
              >
                &times;
              </button>
            </div>

            <AudioDeviceSettings deviceState={deviceState} />

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowAudioModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-blue-600/30"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hotkey & Background Controls Modal */}
      {showHotkeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900/95 border border-white/20 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⌨️</span>
                <h3 className="font-bold text-base sm:text-lg">Горячая клавиша микрофона</h3>
              </div>
              <button
                onClick={() => {
                  cancelRecording();
                  setShowHotkeyModal(false);
                }}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-gray-300">
                Нажмите назначенную клавишу, чтобы мгновенно включить или выключить микрофон.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-white/5 border border-white/10 rounded-xl">
                <div>
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    Текущая клавиша / кнопка:
                  </div>
                  <div className="text-lg font-mono font-bold text-blue-400 mt-0.5 flex items-center gap-1.5">
                    <span>{hotkey.type === 'mouse' ? '🖱️' : '⌨️'}</span>
                    <span>{isRecording ? 'Ожидание нажатия...' : hotkey.label}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={isRecording ? cancelRecording : startRecording}
                    className={`px-3 py-2 rounded-lg font-medium text-xs transition-all flex-1 sm:flex-none ${
                      isRecording
                        ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                    }`}
                  >
                    {isRecording ? 'Отмена' : 'Назначить'}
                  </button>
                  <button
                    onClick={resetHotkey}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg text-xs transition-all"
                    title="Сбросить на Ё / `"
                  >
                    Сброс (Ё)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
                  Быстрый выбор кнопки мыши:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {MOUSE_HOTKEY_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        updateHotkey(opt);
                        cancelRecording();
                      }}
                      className={`px-2.5 py-2 rounded-lg text-xs font-medium border transition-all truncate text-center ${
                        hotkey.type === 'mouse' && hotkey.code === opt.code
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-semibold shadow-sm'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'
                      }`}
                      title={opt.label}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {isRecording && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs animate-pulse text-center leading-relaxed">
                  Нажмите <strong>любую клавишу</strong> на клавиатуре (<strong>Ё</strong>, <strong>Пробел</strong>, <strong>F4</strong>) или <strong>кнопку мыши</strong> (<strong>Колёсико</strong>, <strong>Боковая 1 / 2</strong>, <strong>ПКМ</strong>)...
                </div>
              )}
            </div>

            {/* Document Picture-in-Picture Section */}
            <div className="space-y-2 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🪟</span>
                  <h4 className="font-semibold text-xs sm:text-sm">Оверлей поверх всех окон (PiP)</h4>
                </div>
                {isPipSupported && (
                  <button
                    onClick={togglePip}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      pipWindow
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                    }`}
                  >
                    {pipWindow ? 'Закрыть оверлей' : 'Открыть оверлей'}
                  </button>
                )}
              </div>

              {isPipSupported ? (
                <p className="text-xs text-gray-400 leading-relaxed">
                  Открывает компактное плавающее мини-окно, которое висит <strong>поверх всех ваших программ и игр</strong>. В нем отображается статус микрофона и большая кнопка для быстрого переключения.
                </p>
              ) : (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-amber-300">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Ваш браузер не поддерживает Document Picture-in-Picture</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">
                    В вашем текущем браузере (например, Safari или Firefox) <strong>недоступна функция выноса плавающего мини-окна (оверлея) поверх других окон и игр</strong>.
                  </p>
                  <p className="text-gray-400 leading-relaxed">
                    Горячая клавиша <strong>{hotkey.label}</strong> по-прежнему работает в активном окне браузера. Для использования плавающего оверлея поверх всех окон используйте Google Chrome, Microsoft Edge или Яндекс.Браузер.
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Mode or Browser Info */}
            {isDesktop ? (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-200 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-emerald-300">
                  <span className="text-base">🖥️</span>
                  <span>Десктоп-режим активен (Tauri)</span>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  Горячая клавиша или кнопка мыши <strong>[{hotkey.label}]</strong> перехватывается на уровне операционной системы Windows. Она работает <strong>в любых полноэкранных играх и свёрнутом приложении</strong>!
                </p>
              </div>
            ) : (
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-xs space-y-1.5">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <span>🛡️</span> Работа в фоновом режиме:
                </p>
                <p className="text-gray-400 leading-relaxed">
                  По стандартам безопасности W3C браузеры <strong>запрещают сайтам перехватывать нажатия клавиатуры в фоне</strong>, чтобы защитить ваши данные и пароли от кейлоггинга.
                </p>
                <p className="text-gray-400 leading-relaxed">
                  Для выключения микрофона без переключения на браузер вы можете использовать <strong>кнопку Mute на гарнитуре</strong> или <strong>мультимедийные клавиши</strong>.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                onClick={() => {
                  cancelRecording();
                  setShowHotkeyModal(false);
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Picture-in-Picture Overlay Portal */}
      {pipWindow &&
        createPortal(
          <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-slate-900 select-none text-white">
            <div className="text-[11px] font-semibold text-gray-400 mb-2 truncate max-w-full">
              VoiceChat • {roomId}
            </div>
            <button
              onClick={toggleMute}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isMuted
                  ? 'bg-red-700 hover:bg-red-800 shadow-lg shadow-red-900/50'
                  : 'bg-white/10 hover:bg-white/20 border-2 border-white/30'
              }`}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              {isMuted ? (
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            <div className="mt-2 text-center">
              <span className={`text-xs font-semibold ${isMuted ? 'text-red-400' : 'text-green-400'}`}>
                {isMuted ? 'Микрофон ВЫКЛ' : 'Микрофон ВКЛ'}
              </span>
              <span className="text-[10px] text-gray-500 block font-mono">
                Клавиша: [{hotkey.label}]
              </span>
            </div>
          </div>,
          pipWindow.document.body
        )}
    </>
  );
};
