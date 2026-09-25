import React, { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceChat } from '../hooks/useVoiceChat';
import {
  useHotkey,
  isHotkeyMatch,
  isSameHotkey,
  MOUSE_HOTKEY_OPTIONS,
  DEFAULT_MUTE_HOTKEY,
  DEFAULT_DEAFEN_HOTKEY,
  HotkeyConfig,
} from '../hooks/useHotkey';
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Volume2,
  Sparkles,
  PhoneOff,
  Pencil,
  Keyboard,
  Share2,
  Mouse,
  Users,
  X,
  Check,
  Copy,
  UserPlus,
  AppWindow,
  MessageSquare,
  Monitor,
  AlertTriangle,
  Shield,
  Info,
  Volume1,
  Settings,
} from 'lucide-react';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { AudioDeviceSettings } from './AudioDeviceSettings';
import { ChatPanel } from './ChatPanel';
import { getShareUrl, isTauri } from '../config';
import { playLeaveSound } from '../utils/soundEffects';
import { Tooltip } from './Tooltip';
import { JellyBackground } from './JellyBackground';
import { Modal } from './Modal';
import { useIsSmartphone } from '../utils/device';

interface VoiceChatScreenProps {
  nickname: string;
  roomId: string;
  deviceState?: ReturnType<typeof useAudioDevices>;
  onLeave?: () => void;
}

export const VoiceChatScreen: React.FC<VoiceChatScreenProps> = memo(({
  nickname,
  roomId,
  deviceState,
  onLeave,
}) => {
  const {
    isConnected,
    isMuted,
    isDeafened,
    isSpeaking,
    peers,
    error,
    connectionStatus,
    needsAudioUnlock,
    unlockAudio,
    toggleMute,
    toggleDeafen,
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

  const [hotkeyConflictNotice, setHotkeyConflictNotice] = useState<string | null>(null);

  const deafenHotkeyRef = useRef<HotkeyConfig>(DEFAULT_DEAFEN_HOTKEY);
  const updateDeafenHotkeyRef = useRef<(cfg: HotkeyConfig) => void>(() => {});
  const muteHotkeyRef = useRef<HotkeyConfig>(DEFAULT_MUTE_HOTKEY);
  const updateMuteHotkeyRef = useRef<(cfg: HotkeyConfig) => void>(() => {});

  const handleBeforeMuteUpdate = useCallback((newConfig: HotkeyConfig) => {
    const currentDeafen = deafenHotkeyRef.current;
    if (isSameHotkey(newConfig, currentDeafen)) {
      const replacement = isSameHotkey(newConfig, DEFAULT_DEAFEN_HOTKEY)
        ? muteHotkeyRef.current
        : DEFAULT_DEAFEN_HOTKEY;
      updateDeafenHotkeyRef.current(replacement);
      setHotkeyConflictNotice(
        `Клавиша «${newConfig.label}» была назначена на микрофон. Для глушения звука установлена «${replacement.label}».`
      );
    }
  }, []);

  const handleBeforeDeafenUpdate = useCallback((newConfig: HotkeyConfig) => {
    const currentMute = muteHotkeyRef.current;
    if (isSameHotkey(newConfig, currentMute)) {
      const replacement = isSameHotkey(newConfig, DEFAULT_MUTE_HOTKEY)
        ? deafenHotkeyRef.current
        : DEFAULT_MUTE_HOTKEY;
      updateMuteHotkeyRef.current(replacement);
      setHotkeyConflictNotice(
        `Клавиша «${newConfig.label}» была назначена на глушение звука. Для микрофона установлена «${replacement.label}».`
      );
    }
  }, []);

  const {
    hotkey: muteHotkey,
    isRecording: isMuteRecording,
    isDesktop,
    startRecording: startMuteRecording,
    cancelRecording: cancelMuteRecording,
    resetHotkey: resetMuteHotkey,
    updateHotkey: updateMuteHotkey,
  } = useHotkey({
    onTrigger: toggleMute,
    enabled: true,
    storageKey: 'voice_chat_mute_hotkey',
    defaultHotkey: DEFAULT_MUTE_HOTKEY,
    onBeforeUpdate: handleBeforeMuteUpdate,
  });

  const {
    hotkey: deafenHotkey,
    isRecording: isDeafenRecording,
    startRecording: startDeafenRecording,
    cancelRecording: cancelDeafenRecording,
    resetHotkey: resetDeafenHotkey,
    updateHotkey: updateDeafenHotkey,
  } = useHotkey({
    onTrigger: toggleDeafen,
    enabled: true,
    storageKey: 'voice_chat_deafen_hotkey',
    defaultHotkey: DEFAULT_DEAFEN_HOTKEY,
    onBeforeUpdate: handleBeforeDeafenUpdate,
  });

  useEffect(() => {
    deafenHotkeyRef.current = deafenHotkey;
    updateDeafenHotkeyRef.current = updateDeafenHotkey;
  }, [deafenHotkey, updateDeafenHotkey]);

  useEffect(() => {
    muteHotkeyRef.current = muteHotkey;
    updateMuteHotkeyRef.current = updateMuteHotkey;
  }, [muteHotkey, updateMuteHotkey]);

  const isSmartphone = useIsSmartphone();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'audio' | 'hotkeys'>('audio');
  const effectiveTab = isSmartphone ? 'audio' : settingsTab;
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

  // Close PiP window when leaving room or unmounting
  useEffect(() => {
    return () => {
      if (pipWindow) {
        try {
          pipWindow.close();
        } catch (e) {}
      }
    };
  }, [pipWindow]);

  // Handle hotkeys inside PiP window when focused
  useEffect(() => {
    if (!pipWindow) return;

    const handlePipKeyDown = (e: KeyboardEvent) => {
      if (isHotkeyMatch(e, muteHotkey)) {
        e.preventDefault();
        toggleMute();
      } else if (isHotkeyMatch(e, deafenHotkey)) {
        e.preventDefault();
        toggleDeafen();
      }
    };

    const handlePipMouseDown = (e: MouseEvent) => {
      if (muteHotkey.type === 'mouse' && muteHotkey.button === e.button) {
        e.preventDefault();
        e.stopPropagation();
        toggleMute();
      } else if (deafenHotkey.type === 'mouse' && deafenHotkey.button === e.button) {
        e.preventDefault();
        e.stopPropagation();
        toggleDeafen();
      }
    };

    pipWindow.addEventListener('keydown', handlePipKeyDown);
    pipWindow.addEventListener('mousedown', handlePipMouseDown);
    return () => {
      pipWindow.removeEventListener('keydown', handlePipKeyDown);
      pipWindow.removeEventListener('mousedown', handlePipMouseDown);
    };
  }, [pipWindow, muteHotkey, deafenHotkey, toggleMute, toggleDeafen]);

  const prevVolumesRef = useRef<Map<string, number>>(new Map());

  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareKey, setShareKey] = useState(0);
  const shareTimerRef = useRef<number | null>(null);
  const [myNickname, setMyNickname] = useState(nickname);
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [isMobileEditingNick, setIsMobileEditingNick] = useState(false);
  const [newNickInput, setNewNickInput] = useState(nickname);

  // Selected peer for mobile volume modal
  const [selectedMobilePeer, setSelectedMobilePeer] = useState<any | null>(null);
  const [cachedMobilePeer, setCachedMobilePeer] = useState<any | null>(null);

  useEffect(() => {
    if (selectedMobilePeer) {
      setCachedMobilePeer(selectedMobilePeer);
    }
  }, [selectedMobilePeer]);

  const getInitials = useCallback((name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, []);

  const getAvatarGradient = useCallback((idOrName: string) => {
    const gradients = [
      'from-blue-600 to-indigo-800',
      'from-violet-600 to-purple-800',
      'from-cyan-600 to-blue-800',
      'from-emerald-600 to-teal-800',
      'from-amber-600 to-orange-800',
      'from-rose-600 to-pink-800',
      'from-fuchsia-600 to-indigo-800',
    ];
    let hash = 0;
    for (let i = 0; i < idOrName.length; i++) {
      hash = idOrName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  }, []);

  const closeShare = useCallback(() => {
    if (shareTimerRef.current) {
      clearTimeout(shareTimerRef.current);
      shareTimerRef.current = null;
    }
    setShowShare(false);
  }, []);

  const triggerShare = useCallback(() => {
    // If already open, close it smoothly
    if (showShare) {
      closeShare();
      return;
    }

    // Auto-copy link to clipboard when sharing
    const url = getShareUrl(roomId);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});

    // Open with smooth accordion animation
    setShowShare(true);
    setShareKey((k) => k + 1);

    // Automatically close with smooth accordion animation after 10 seconds
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = window.setTimeout(() => {
      setShowShare(false);
    }, 10000);
  }, [showShare, closeShare, roomId]);

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);

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
    playLeaveSound();
    if (onLeave) {
      onLeave();
    } else {
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
      <div
        className={`p-3 rounded-xl border transition-all ${
          isSpeaking && !isMuted && !isDeafened
            ? 'border-green-500/50 bg-green-500/[0.06] shadow-sm shadow-green-500/20 ring-1 ring-green-500/30'
            : 'bg-black/30 hover:bg-black/40 border-blue-500/30 hover:border-blue-500/45'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-md transition-all ${
                isSpeaking && !isMuted && !isDeafened
                  ? 'bg-gradient-to-br from-emerald-600 to-teal-800 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-emerald-500/40 animate-pulse scale-105 text-white'
                  : isDeafened
                  ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                  : isMuted
                  ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-800 border border-blue-400/30 text-white shadow-md'
              }`}
            >
              {getInitials(myNickname)}
            </div>

            {/* Avatar Status Badge in corner */}
            {isDeafened ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                <VolumeX className="w-2.5 h-2.5" />
              </span>
            ) : isMuted ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                <MicOff className="w-2.5 h-2.5" />
              </span>
            ) : null}
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
                  className="flex-1 min-w-0 px-2 py-0.5 text-xs bg-black/40 border border-blue-400/60 rounded text-white focus:outline-none"
                />
                <Tooltip content="Сохранить" position="top">
                  <button type="submit" className="text-green-400 hover:text-green-300 p-0.5 rounded hover:bg-white/10 transition-colors">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
                <Tooltip content="Отмена" position="top">
                  <button type="button" onClick={() => setIsEditingNick(false)} className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-white/10 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </form>
            ) : (
              <Tooltip content="Изменить никнейм" description="Нажмите, чтобы изменить свой никнейм" position="top">
                <div
                  onClick={() => setIsEditingNick(true)}
                  className="group cursor-pointer flex items-center gap-1.5 hover:text-blue-300 transition-colors"
                >
                  <span className="text-white font-semibold text-xs sm:text-sm truncate max-w-[120px]">
                    {myNickname}
                  </span>
                  <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-60 group-hover:opacity-100 group-hover:text-blue-300 flex-shrink-0 transition-all" />
                </div>
              </Tooltip>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              {isDeafened ? (
                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded border border-rose-500/30 font-medium">
                  Заглушен (всё)
                </span>
              ) : isMuted ? (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded border border-red-500/30 font-medium">
                  Заглушен
                </span>
              ) : isSpeaking ? (
                <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.2 rounded border border-green-500/40 font-medium flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Говорит
                </span>
              ) : (
                <span className="text-[10px] bg-blue-500/15 text-blue-300 px-1.5 py-0.2 rounded border border-blue-500/30 font-semibold">
                  Вы
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Remote Peers Cards */}
      {peers.map((peer) => {
        const vol = peerVolumes[peer.peerId] ?? 100;
        const isPeerSpeaking = peer.isSpeaking && !peer.isMuted && !peer.isDeafened;
        const gradient = getAvatarGradient(peer.peerId || peer.nickname);

        return (
          <div
            key={peer.peerId}
            className={`p-3 rounded-xl border transition-all animate-fade-in ${
              isPeerSpeaking
                ? 'border-green-500/50 bg-green-500/[0.06] shadow-sm shadow-green-500/20 ring-1 ring-green-500/30'
                : 'bg-black/30 hover:bg-black/40 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-md transition-all ${
                    isPeerSpeaking
                      ? 'bg-gradient-to-br from-emerald-600 to-teal-800 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-emerald-500/40 animate-pulse scale-105 text-white'
                      : peer.isDeafened
                      ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                      : peer.isMuted
                      ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                      : `bg-gradient-to-br ${gradient} border border-white/20 text-white shadow-md`
                  }`}
                >
                  {getInitials(peer.nickname)}
                </div>

                {/* Avatar Status Badge in corner */}
                {peer.isDeafened ? (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                    <VolumeX className="w-2.5 h-2.5" />
                  </span>
                ) : peer.isMuted ? (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                    <MicOff className="w-2.5 h-2.5" />
                  </span>
                ) : null}
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-white font-semibold text-xs sm:text-sm truncate block">
                  {peer.nickname}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {peer.isDeafened ? (
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded border border-rose-500/30 font-medium">
                      Заглушен (всё)
                    </span>
                  ) : peer.isMuted ? (
                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded border border-red-500/30 font-medium">
                      Заглушен
                    </span>
                  ) : isPeerSpeaking ? (
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
                  className="hover:text-white transition-colors flex items-center gap-1.5 text-[11px] p-0.5 -m-0.5 cursor-pointer"
                  title={vol === 0 ? 'Включить звук' : 'Заглушить'}
                >
                  {vol === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-red-400" />
                  ) : vol < 50 ? (
                    <Volume1 className="w-3.5 h-3.5 text-blue-300" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-blue-300" />
                  )}
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
        <Tooltip content="Скопировать ссылку" description="Нажмите, чтобы скопировать приглашение в буфер" position="top">
          <div
            onClick={copyRoomId}
            role="button"
            tabIndex={0}
            className="bg-black/30 hover:bg-black/40 border border-white/10 hover:border-white/20 active:scale-[0.98] cursor-pointer transition-all rounded-xl p-3 flex items-center gap-3 select-none group animate-fade-in"
          >
            <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-blue-400 group-hover:border-blue-400/30 transition-all flex-shrink-0">
              <div className="relative w-5 h-5 flex items-center justify-center">
                <Check
                  className={`w-5 h-5 text-emerald-400 absolute transition-all duration-300 ease-out ${
                    copied ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-[-45deg] pointer-events-none'
                  }`}
                />
                <UserPlus
                  className={`w-5 h-5 text-gray-400 group-hover:text-blue-400 absolute transition-all duration-300 ease-out ${
                    copied ? 'opacity-0 scale-50 rotate-45 pointer-events-none' : 'opacity-100 scale-100 rotate-0'
                  }`}
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-medium truncate block transition-colors duration-200 ${copied ? 'text-emerald-400 font-semibold' : 'text-gray-300 group-hover:text-white'}`}>
                {copied ? 'Ссылка скопирована!' : 'Ожидание участников...'}
              </span>
              <span className={`text-[11px] truncate block mt-0.5 transition-colors duration-200 ${copied ? 'text-emerald-400/80' : 'text-gray-500'}`}>
                {copied ? 'Отправьте её друзьям' : 'Нажмите, чтобы скопировать'}
              </span>
            </div>
          </div>
        </Tooltip>
      )}
    </div>
  );

  return (
    <>
      {/* Jelly Background */}
      <JellyBackground />

      {/* Root Layout */}
      <div
        className="content-wrapper h-full w-full flex-1 flex flex-col overflow-hidden text-white font-sans animate-fade-in"
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
            className="cursor-pointer bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 hover:from-amber-500 hover:to-yellow-500 text-white px-3 sm:px-4 py-2 text-center text-xs sm:text-sm font-medium shadow-lg flex items-center justify-center gap-2 border-b border-amber-400/40 transition-all z-50 animate-slide-down-fade flex-shrink-0"
          >
            <Volume2 className="w-4 h-4 flex-shrink-0 text-white" />
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

        {/* Global Share Panel (Smooth Accordion Animated without layout shifts) */}
        <div
          className={`grid-accordion flex-shrink-0 z-30 ${
            showShare ? 'grid-accordion-expanded' : 'grid-accordion-collapsed'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className={`bg-slate-950/80 backdrop-blur-xl border-b border-blue-500/25 px-3 py-2.5 sm:py-3 relative shadow-2xl accordion-inner ${
                showShare ? 'accordion-inner-expanded' : 'accordion-inner-collapsed'
              }`}
            >
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
                {/* Desktop Left Info: Share icon & title (hidden on < 640px) */}
                <div className="hidden sm:flex items-center gap-2.5 min-w-0 flex-shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm flex-shrink-0">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white truncate">Ссылка на комнату</span>
                    <span className="text-[10px] text-blue-300/80 truncate">Исчезнет через 10 секунд</span>
                  </div>
                </div>

                {/* Unified Link & Action Row: single streamlined row on mobile and desktop */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                  {/* On mobile: compact share icon */}
                  <div className="sm:hidden w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>

                  {/* Input with tap-to-copy */}
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="text"
                      readOnly
                      value={shareLink}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).select();
                        copyRoomId();
                      }}
                      className="w-full py-1.5 sm:py-2 px-2.5 sm:px-3 bg-black/40 hover:bg-black/50 border border-white/10 focus:border-blue-400/50 rounded-xl text-white text-xs font-mono select-all focus:outline-none transition-colors truncate cursor-pointer"
                    />
                  </div>

                  {/* Copy Button */}
                  <Tooltip content={copied ? "Скопировано!" : "Скопировать ссылку"} description="Скопировать ссылку в буфер обмена" position="bottom">
                    <button
                      type="button"
                      onClick={copyRoomId}
                      className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-medium transition-all text-xs flex items-center justify-center gap-1.5 flex-shrink-0 shadow-sm active:scale-95 whitespace-nowrap cursor-pointer ${
                        copied
                          ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                          : 'bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white shadow-blue-900/40'
                      }`}
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 flex-shrink-0 text-white animate-scale-up" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 flex-shrink-0 text-white" />
                      )}
                      <span className="share-btn-text">{copied ? 'Скопировано!' : 'Копировать'}</span>
                    </button>
                  </Tooltip>

                  {/* Single Close Button */}
                  <Tooltip content="Закрыть" description="Скрыть панель ссылки" position="bottom">
                    <button
                      onClick={closeShare}
                      className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer"
                      aria-label="Закрыть"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* 10-second animated progress line */}
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 overflow-hidden">
                <div
                  key={shareKey}
                  className={`h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400 ${
                    showShare ? 'animate-countdown-10s' : 'opacity-0'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Reimagined Unified Mobile Header (< 1024px) with Safe-Area Padding */}
        <header
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
          className="lg:hidden px-3.5 pb-2.5 pt-2 border-b border-white/10 backdrop-blur-xl bg-slate-950/60 flex items-center justify-between gap-2.5 flex-shrink-0 z-20"
        >
          {/* Left: Branding & Room Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-bold text-white tracking-tight flex-shrink-0">VoiceChat</span>
              <Tooltip content={copied ? "Скопировано!" : "Скопировать ссылку"} description="Скопировать ссылку на комнату в буфер" position="bottom">
                <button
                  type="button"
                  onClick={copyRoomId}
                  className="text-xs text-gray-400 hover:text-blue-300 font-mono transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-white/5 active:scale-95"
                >
                  <span className="font-semibold">#{roomId}</span>
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 animate-scale-up" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-white flex-shrink-0 transition-colors" />
                  )}
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Tooltip
              content={isSmartphone ? "Настройки звука" : "Настройки"}
              description={isSmartphone ? "Выбор микрофона и динамиков" : "Звук, микрофон и горячие клавиши"}
              position="bottom"
            >
              <button
                type="button"
                onClick={() => {
                  setSettingsTab('audio');
                  setShowSettingsModal(true);
                }}
                className="p-2 text-gray-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 rounded-xl border border-white/10 text-xs transition-all flex items-center justify-center cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Поделиться ссылкой" description="Показать ссылку на комнату на 10 секунд" position="bottom">
              <button
                onClick={triggerShare}
                className={`p-2 active:scale-95 rounded-xl border text-xs transition-all flex items-center justify-center ${
                  showShare
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                    : 'text-gray-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border-white/10'
                }`}
              >
                <Share2 className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </header>

        {/* Clubhouse-Style Mobile Participants Card (< 1024px) */}
        <div className="lg:hidden px-2 pt-2 sm:px-4 sm:pt-4 flex-shrink-0 z-10">
          <div className="bg-slate-950/45 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/40 px-3 py-2 sm:px-4 sm:py-2.5 overflow-hidden">
            <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2.5 px-1">
              {/* 1. Self Participant Circle */}
              <Tooltip
                content={myNickname}
                description="Нажмите, чтобы изменить свой никнейм"
                position="bottom"
              >
                <div
                  onClick={() => {
                    setNewNickInput(myNickname);
                    setIsMobileEditingNick(true);
                  }}
                  className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group active:scale-95 transition-transform"
                >
                  <div className="relative">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-all ${
                        isSpeaking && !isMuted
                          ? 'bg-gradient-to-br from-emerald-600 to-teal-800 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-emerald-500/40 animate-pulse scale-105 text-white'
                          : isDeafened
                          ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                          : isMuted
                          ? 'bg-white/10 border border-white/15 text-gray-400'
                          : 'bg-gradient-to-br from-blue-600 to-indigo-800 border border-blue-400/30 text-white'
                      }`}
                    >
                      {getInitials(myNickname)}
                    </div>

                    {/* Hover Edit Pencil Overlay on Avatar */}
                    <div className="absolute inset-0 rounded-full bg-slate-950/70 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-inner">
                      <Pencil className="w-4 h-4 text-white drop-shadow-md" />
                    </div>

                    {/* Status Badge in corner */}
                    {isDeafened ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                        <VolumeX className="w-2.5 h-2.5" />
                      </span>
                    ) : isMuted ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                        <MicOff className="w-2.5 h-2.5" />
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-center gap-0.5 mt-0.5">
                    <span
                      className={`text-[11px] font-semibold truncate max-w-[68px] text-center ${
                        isSpeaking && !isMuted ? 'text-emerald-400' : 'text-blue-300'
                      }`}
                    >
                      {myNickname}
                    </span>
                    <div className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-300 flex items-center justify-center">
                      Вы
                    </div>
                  </div>
                </div>
              </Tooltip>

              {/* 2. Remote Peers Circles */}
              {peers.map((peer) => {
                const vol = peerVolumes[peer.peerId] ?? 100;
                const isPeerSpeaking = peer.isSpeaking && !peer.isMuted && !peer.isDeafened;
                const gradient = getAvatarGradient(peer.peerId || peer.nickname);

                return (
                  <Tooltip
                    key={peer.peerId}
                    content={peer.nickname}
                    description={`Громкость: ${vol}%. Нажмите для настройки звука`}
                    position="bottom"
                  >
                    <div
                      onClick={() => setSelectedMobilePeer(peer)}
                      className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group active:scale-95 transition-transform animate-fade-in"
                    >
                      <div className="relative">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-all ${
                            isPeerSpeaking
                              ? 'bg-gradient-to-br from-emerald-600 to-teal-800 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-emerald-500/40 animate-pulse scale-105 text-white'
                              : peer.isDeafened
                              ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                              : peer.isMuted
                              ? 'bg-white/10 border border-white/15 text-gray-400'
                              : `bg-gradient-to-br ${gradient} border border-white/20 text-white`
                          }`}
                        >
                          {getInitials(peer.nickname)}
                        </div>

                        {/* Hover Settings Gear Overlay on Avatar */}
                        <div className="absolute inset-0 rounded-full bg-slate-950/70 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-inner">
                          <Settings className="w-5 h-5 text-white drop-shadow-md" />
                        </div>

                        {/* Status Badge in corner */}
                        {peer.isDeafened ? (
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                            <VolumeX className="w-2.5 h-2.5" />
                          </span>
                        ) : peer.isMuted ? (
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                            <MicOff className="w-2.5 h-2.5" />
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-center gap-0.5 mt-0.5">
                        <span
                          className={`text-[11px] font-medium truncate max-w-[68px] text-center ${
                            isPeerSpeaking ? 'text-emerald-400 font-semibold' : 'text-gray-200'
                          }`}
                        >
                          {peer.nickname}
                        </span>
                        <div
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold flex items-center justify-center border transition-all ${
                            vol === 0
                              ? 'bg-red-500/20 border-red-500/30 text-red-300'
                              : vol > 100
                              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 font-bold'
                              : 'bg-white/10 border-white/10 text-gray-300 group-hover:bg-white/15 group-hover:text-white'
                          }`}
                        >
                          {vol === 0 ? '0%' : `${vol}%`}
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                );
              })}

              {/* 3. Invite Button */}
              <Tooltip
                content="Пригласить друга"
                description={copied ? "Ссылка уже в буфере обмена!" : "Скопировать ссылку на комнату"}
                position="bottom"
              >
                <div
                  onClick={copyRoomId}
                  className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group active:scale-95 transition-transform"
                >
                  <div
                    className={`w-12 h-12 rounded-full border transition-all duration-300 ease-out flex items-center justify-center shadow-md ${
                      copied
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-emerald-950/40'
                        : 'border-blue-500/30 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 group-hover:text-white shadow-blue-950/40'
                    }`}
                  >
                    <div className="relative w-5 h-5 flex items-center justify-center">
                      <Check
                        className={`w-5 h-5 text-emerald-400 absolute transition-all duration-300 ease-out ${
                          copied ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-[-45deg] pointer-events-none'
                        }`}
                      />
                      <UserPlus
                        className={`w-5 h-5 text-blue-400 group-hover:text-white absolute transition-all duration-300 ease-out ${
                          copied ? 'opacity-0 scale-50 rotate-45 pointer-events-none' : 'opacity-100 scale-100 rotate-0'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 mt-0.5">
                    <div className="relative h-4 w-16 flex items-center justify-center overflow-hidden">
                      <span
                        className={`text-[11px] font-semibold text-emerald-400 whitespace-nowrap text-center transition-all duration-300 ease-out absolute inset-x-0 ${
                          copied ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90 pointer-events-none'
                        }`}
                      >
                        Готово
                      </span>
                      <span
                        className={`text-[11px] text-gray-300 group-hover:text-blue-300 font-medium whitespace-nowrap text-center transition-all duration-300 ease-out absolute inset-x-0 ${
                          copied ? 'opacity-0 -translate-y-2 scale-90 pointer-events-none' : 'opacity-100 translate-y-0 scale-100'
                        }`}
                      >
                        + Друг
                      </span>
                    </div>
                    <div
                      className={`px-2 py-0.5 rounded-full text-[9px] font-medium border transition-all duration-300 ease-out ${
                        copied
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-blue-500/15 border-blue-500/25 text-blue-300 group-hover:border-blue-400/40'
                      }`}
                    >
                      <div className="relative h-3 w-14 flex items-center justify-center overflow-hidden">
                        <span
                          className={`transition-all duration-300 ease-out absolute inset-x-0 text-center whitespace-nowrap ${
                            copied ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                          }`}
                        >
                          Скопировано
                        </span>
                        <span
                          className={`transition-all duration-300 ease-out absolute inset-x-0 text-center whitespace-nowrap ${
                            copied ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
                          }`}
                        >
                          Инвайт
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Desktop & Main Content Split (Option 3 Layout) */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* DESKTOP SIDEBAR (>= 1024px) */}
          <aside className="hidden lg:flex flex-col w-80 xl:w-84 2xl:w-96 border-r border-white/10 bg-slate-950/45 backdrop-blur-xl flex-shrink-0 select-none">
            {/* Sidebar Top: Logo & Room info */}
            <div className="p-3.5 px-4 border-b border-white/10 flex items-center justify-between bg-slate-950/60 backdrop-blur-xl">
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
                <Tooltip content="Настройки" description="Звук, микрофон и горячие клавиши" position="bottom">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab('audio');
                      setShowSettingsModal(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </Tooltip>
                <Tooltip content="Поделиться ссылкой" description="Показать ссылку на комнату на 10 секунд" position="bottom">
                  <button
                    type="button"
                    onClick={triggerShare}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </Tooltip>
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
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Участники ({peers.length + 1})
                  </span>
                  {peers.length + 1 >= 8 && (
                    <Tooltip
                      content="Mesh P2P (8+)"
                      description="В комнате более 8 участников. P2P mesh-сеть передаёт аудио напрямую каждому участнику."
                      position="bottom"
                    >
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono cursor-default">
                        Mesh P2P (8+)
                      </span>
                    </Tooltip>
                  )}
                </div>
                <span className="text-[10px] text-blue-400 font-mono">
                  {peers.filter(p => !p.isMuted).length + (!isMuted ? 1 : 0)} с микрофоном
                </span>
              </div>

              {renderParticipantList()}
            </div>

            {/* Desktop Sidebar Bottom Dock: Mic, Deafen, Noise Suppression, Status */}
            <div className="p-3 border-t border-white/10 bg-slate-950/60 backdrop-blur-xl space-y-2.5 flex-shrink-0">
              <div className="flex items-center justify-start gap-2">
                {/* Mute toggle button */}
                <Tooltip
                  content={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                  description={isMuted ? 'Включить передачу вашего голоса' : 'Отключить передачу звука'}
                  hotkey={muteHotkey.label}
                  position="top"
                >
                  <button
                    onClick={toggleMute}
                    className={`w-11 h-11 rounded-xl border transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md ${
                      isMuted
                        ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 shadow-sm shadow-red-950/40'
                        : 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white'
                    }`}
                  >
                    {isMuted ? (
                      <MicOff className="w-5 h-5 text-red-400" />
                    ) : (
                      <Mic className="w-5 h-5 text-white" />
                    )}
                  </button>
                </Tooltip>

                {/* Deafen toggle button */}
                <Tooltip
                  content={isDeafened ? 'Включить звук (Deafen)' : 'Заглушить всё (Deafen)'}
                  description={isDeafened ? 'Вернуть звук собеседников и включить микрофон' : 'Полностью отключить весь входящий звук и микрофон'}
                  hotkey={deafenHotkey.label}
                  position="top"
                >
                  <button
                    onClick={toggleDeafen}
                    className={`w-11 h-11 rounded-xl border transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md ${
                      isDeafened
                        ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 shadow-sm shadow-red-950/40'
                        : 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white'
                    }`}
                  >
                    {isDeafened ? (
                      <VolumeX className="w-5 h-5 text-red-400" />
                    ) : (
                      <Headphones className="w-5 h-5 text-white" />
                    )}
                  </button>
                </Tooltip>

                {/* RNNoise Toggle */}
                <Tooltip
                  content="Шумоподавление"
                  description={isNoiseSuppression ? 'AI-фильтрация шумов активна (RNNoise)' : 'Включить нейросетевую очистку шума'}
                  position="top"
                >
                  <button
                    onClick={toggleNoiseSuppression}
                    className={`w-11 h-11 rounded-xl border transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md ${
                      isNoiseSuppression
                        ? 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white'
                        : 'bg-white/[0.04] border border-white/10 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                  </button>
                </Tooltip>

                {/* Leave Button */}
                <Tooltip
                  content="Выйти из комнаты"
                  description="Отключиться и вернуться на главный экран"
                  position="top"
                >
                  <button
                    onClick={handleLeave}
                    className="w-11 h-11 rounded-xl bg-red-500/10 hover:bg-red-600/30 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md"
                  >
                    <PhoneOff className="w-5 h-5 text-red-400" />
                  </button>
                </Tooltip>
              </div>

              {/* Status Wave & Hotkey note */}
              <div className="flex items-center justify-between text-[11px] text-gray-400 px-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {!isMuted && isConnected && (
                    <div className="flex items-center gap-0.5 h-3 flex-shrink-0">
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
                  <span className={`truncate ${isDeafened ? 'text-red-400 font-medium' : isMuted ? 'text-red-400' : isSpeaking ? 'text-green-400' : 'text-blue-400'}`}>
                    {isDeafened ? 'Заглушен (всё)' : isMuted ? 'Заглушен' : isSpeaking ? 'Говорит...' : 'В эфире'}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Tooltip content="Хоткей микрофона" description={`Текущая клавиша: [${muteHotkey.label}]`} position="top">
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsTab('hotkeys');
                        setShowSettingsModal(true);
                      }}
                      className="font-mono text-[10px] bg-white/[0.05] hover:bg-white/[0.10] px-1.5 py-0.5 rounded text-gray-300 hover:text-white transition-colors border border-white/10 flex items-center gap-1 cursor-pointer"
                    >
                      <Mic className="w-3 h-3 text-blue-400" />
                      <span>[{muteHotkey.label}]</span>
                    </button>
                  </Tooltip>
                  <Tooltip content="Хоткей звука" description={`Текущая клавиша: [${deafenHotkey.label}]`} position="top">
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsTab('hotkeys');
                        setShowSettingsModal(true);
                      }}
                      className="font-mono text-[10px] bg-white/[0.05] hover:bg-white/[0.10] px-1.5 py-0.5 rounded text-gray-300 hover:text-white transition-colors border border-white/10 flex items-center gap-1 cursor-pointer"
                    >
                      <VolumeX className="w-3 h-3 text-red-400" />
                      <span>[{deafenHotkey.label}]</span>
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN CHAT AREA (Full height, center on desktop, full screen on mobile) */}
          <main className="flex-1 flex flex-col min-w-0 p-2 pt-2 sm:p-4 sm:pt-3 lg:p-5 overflow-hidden">
            <ChatPanel
              roomId={roomId}
              messages={messages}
              myPeerId={myPeerId}
              onSendMessage={sendChatMessage}
              participantCount={peers.length + 1}
              className="flex-1 min-h-0"
            />
          </main>
        </div>

        {/* Mobile Sticky Bottom Controls (< 1024px) with Safe-Area Inset */}
        <div
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.625rem)' }}
          className="lg:hidden p-2.5 sm:p-3 bg-slate-950/60 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-2.5 sm:gap-3 flex-shrink-0 z-20"
        >
          <Tooltip
            content={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            description={isMuted ? 'Включить передачу вашего голоса' : 'Отключить передачу звука'}
            hotkey={muteHotkey.label}
            position="top"
          >
            <button
              onClick={toggleMute}
              className={`w-11 h-11 rounded-xl border transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md ${
                isMuted
                  ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 shadow-sm shadow-red-950/40'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white'
              }`}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5 text-red-400" />
              ) : (
                <Mic className="w-5 h-5 text-white" />
              )}
            </button>
          </Tooltip>

          <Tooltip
            content={isDeafened ? 'Включить звук (Deafen)' : 'Заглушить всё (Deafen)'}
            description={isDeafened ? 'Вернуть звук собеседников и включить микрофон' : 'Полностью отключить весь входящий звук и микрофон'}
            hotkey={deafenHotkey.label}
            position="top"
          >
            <button
              onClick={toggleDeafen}
              className={`w-11 h-11 rounded-xl border transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md ${
                isDeafened
                  ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 shadow-sm shadow-red-950/40'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white'
              }`}
            >
              {isDeafened ? (
                <VolumeX className="w-5 h-5 text-red-400" />
              ) : (
                <Headphones className="w-5 h-5 text-white" />
              )}
            </button>
          </Tooltip>

          <Tooltip
            content="Шумоподавление"
            description={isNoiseSuppression ? 'AI-фильтрация шумов активна (RNNoise)' : 'Включить нейросетевую очистку шума'}
            position="top"
          >
            <button
              onClick={toggleNoiseSuppression}
              className={`w-11 h-11 rounded-xl border transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md ${
                isNoiseSuppression
                  ? 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white'
                  : 'bg-white/[0.04] border border-white/10 text-gray-400 hover:text-gray-200'
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </button>
          </Tooltip>

          <Tooltip
            content="Выйти из комнаты"
            description="Отключиться и вернуться на главный экран"
            position="top"
          >
            <button
              onClick={handleLeave}
              className="w-11 h-11 rounded-xl bg-red-500/10 hover:bg-red-600/30 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md"
            >
              <PhoneOff className="w-5 h-5 text-red-400" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Mobile Peer Volume Modal */}
      <Modal
        isOpen={Boolean(selectedMobilePeer)}
        onClose={() => setSelectedMobilePeer(null)}
      >
        {cachedMobilePeer && (
          <>
            <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm sm:text-base">Громкость: {cachedMobilePeer.nickname}</h3>
              </div>
              <Tooltip content="Закрыть" position="bottom">
                <button
                  onClick={() => setSelectedMobilePeer(null)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>

            <div className="modal-content-scroll p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base bg-gradient-to-br ${getAvatarGradient(
                    cachedMobilePeer.peerId || cachedMobilePeer.nickname
                  )} text-white`}
                >
                  {getInitials(cachedMobilePeer.nickname)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-semibold text-sm truncate">{cachedMobilePeer.nickname}</p>
                  <p className="text-xs text-gray-400">
                    {cachedMobilePeer.isDeafened
                      ? 'Заглушил весь звук'
                      : cachedMobilePeer.isMuted
                      ? 'Микрофон отключен'
                      : cachedMobilePeer.isSpeaking
                      ? 'Говорит прямо сейчас'
                      : 'В комнате'}
                  </p>
                </div>
              </div>

              {/* Volume slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Volume2 className="w-4 h-4 text-blue-400" />
                    <span>Громкость участника</span>
                  </span>
                  <span className="font-mono font-bold text-blue-300">
                    {peerVolumes[cachedMobilePeer.peerId] ?? 100}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={peerVolumes[cachedMobilePeer.peerId] ?? 100}
                  onChange={(e) => setPeerVolume(cachedMobilePeer.peerId, Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/15 accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>0% (Mute)</span>
                  <span>100% (Норма)</span>
                  <span>200% (Усиление)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 border-t border-white/10 flex-shrink-0 bg-slate-950/50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => {
                  const current = peerVolumes[cachedMobilePeer.peerId] ?? 100;
                  setPeerVolume(cachedMobilePeer.peerId, current === 0 ? 100 : 0);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                  (peerVolumes[cachedMobilePeer.peerId] ?? 100) === 0
                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                    : 'bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 border-white/10 hover:text-white'
                }`}
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>{(peerVolumes[cachedMobilePeer.peerId] ?? 100) === 0 ? 'Включить звук' : 'Заглушить'}</span>
              </button>
              <button
                onClick={() => setSelectedMobilePeer(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-blue-600/30 active:scale-95"
              >
                Готово
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Nickname Edit Modal (Mobile Only) */}
      <Modal
        isOpen={isMobileEditingNick}
        onClose={() => setIsMobileEditingNick(false)}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-5 flex-shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm sm:text-base">Ваш никнейм</h3>
          </div>
          <Tooltip content="Закрыть" position="bottom">
            <button
              onClick={() => setIsMobileEditingNick(false)}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

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
              setIsMobileEditingNick(false);
            }
          }}
        >
          <div className="modal-content-scroll p-4 sm:p-5 space-y-3">
            <label className="text-xs text-gray-400 block">Введите никнейм для отображения в комнате:</label>
            <input
              type="text"
              value={newNickInput}
              onChange={(e) => setNewNickInput(e.target.value)}
              maxLength={24}
              autoFocus
              className="w-full py-2.5 px-3 bg-black/30 hover:bg-black/40 focus:bg-black/50 border border-white/10 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-white text-base focus:outline-none transition-all"
            />
          </div>

          <div className="flex justify-end gap-2 p-3 sm:p-4 border-t border-white/10 flex-shrink-0 bg-slate-950/50 rounded-b-2xl">
            <button
              type="button"
              onClick={() => setIsMobileEditingNick(false)}
              className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 rounded-xl text-xs sm:text-sm font-medium transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-blue-600/30 active:scale-95"
            >
              Сохранить
            </button>
          </div>
        </form>
      </Modal>

      {/* Unified Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => {
          cancelMuteRecording();
          cancelDeafenRecording();
          setShowSettingsModal(false);
        }}
        className="max-w-lg"
      >
        <div className="border-b border-white/10 p-4 sm:p-5 flex-shrink-0 bg-white/[0.02]">
          <div className={`flex items-center justify-between ${!isSmartphone ? 'mb-3.5' : ''}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                {isSmartphone ? <Headphones className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base leading-snug">
                  {isSmartphone ? 'Настройки звука' : 'Настройки'}
                </h3>
                <p className="text-[11px] text-gray-400">
                  {isSmartphone ? 'Выбор микрофона и динамиков' : 'Управление звуком, микрофоном и клавишами'}
                </p>
              </div>
            </div>
            <Tooltip content="Закрыть" position="bottom">
              <button
                type="button"
                onClick={() => {
                  cancelMuteRecording();
                  cancelDeafenRecording();
                  setShowSettingsModal(false);
                }}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>

          {/* Segmented Tab Switcher (скрыт на смартфонах) */}
          {!isSmartphone && (
            <div className="flex items-center p-1 bg-white/[0.04] border border-white/10 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  cancelMuteRecording();
                  cancelDeafenRecording();
                  setSettingsTab('audio');
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  effectiveTab === 'audio'
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Звук и микрофон</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelMuteRecording();
                  cancelDeafenRecording();
                  setSettingsTab('hotkeys');
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  effectiveTab === 'hotkeys'
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Горячие клавиши</span>
              </button>
            </div>
          )}
        </div>

        <div className="modal-content-scroll p-4 sm:p-5">
          {effectiveTab === 'audio' && (
            <div key="audio-tab" className="animate-tab-fade space-y-4">
              {deviceState ? (
                <AudioDeviceSettings deviceState={deviceState} />
              ) : (
                <div className="py-8 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <span>Инициализация аудиоустройств...</span>
                </div>
              )}
            </div>
          )}

          {!isSmartphone && effectiveTab === 'hotkeys' && (
            <div key="hotkeys-tab" className="animate-tab-fade space-y-4">
              {/* Conflict Notification Banner */}
              {hotkeyConflictNotice && (
                <div className="p-3 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-200 text-xs flex items-start justify-between gap-2.5 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-snug">{hotkeyConflictNotice}</span>
                  </div>
                  <Tooltip content="Закрыть" position="left">
                    <button
                      type="button"
                      onClick={() => setHotkeyConflictNotice(null)}
                      className="p-1 text-blue-300 hover:text-white rounded hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
                      aria-label="Закрыть"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
              )}

              {/* 1. Microphone Mute Hotkey */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-blue-400" />
                    <span>Включение / выключение микрофона</span>
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-white/[0.04] border border-white/10 rounded-xl">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      Текущая клавиша:
                    </div>
                    <div className="text-base font-mono font-bold text-blue-400 mt-0.5 flex items-center gap-1.5">
                      {muteHotkey.type === 'mouse' ? <Mouse className="w-4 h-4 text-blue-400" /> : <Keyboard className="w-4 h-4 text-blue-400" />}
                      <span>{isMuteRecording ? 'Ожидание нажатия...' : muteHotkey.label}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        cancelDeafenRecording();
                        if (isMuteRecording) {
                          cancelMuteRecording();
                        } else {
                          startMuteRecording();
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex-1 sm:flex-none cursor-pointer ${
                        isMuteRecording
                          ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                      }`}
                    >
                      {isMuteRecording ? 'Отмена' : 'Назначить'}
                    </button>
                    <Tooltip content="Сбросить хоткей" description="Сбросить микрофон на клавишу Ё / `" position="top">
                      <button
                        type="button"
                        onClick={resetMuteHotkey}
                        className="px-2.5 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                      >
                        Сброс (Ё)
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {MOUSE_HOTKEY_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        updateMuteHotkey(opt);
                        cancelMuteRecording();
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all truncate text-center cursor-pointer ${
                        muteHotkey.type === 'mouse' && muteHotkey.code === opt.code
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-semibold shadow-sm'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {isMuteRecording && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs animate-fade-in text-center leading-relaxed">
                    Нажмите <strong>любую клавишу</strong> на клавиатуре или <strong>кнопку мыши</strong> для микрофона...
                  </div>
                )}
              </div>

              {/* 2. Deafen Hotkey */}
              <div className="space-y-2 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <VolumeX className="w-4 h-4 text-rose-400" />
                    <span>Полное отключение звука и микрофона (Deafen)</span>
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Мгновенно заглушает ваш микрофон и весь входящий звук от участников в комнате.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-white/[0.04] border border-white/10 rounded-xl">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      Текущая клавиша:
                    </div>
                    <div className="text-base font-mono font-bold text-rose-400 mt-0.5 flex items-center gap-1.5">
                      {deafenHotkey.type === 'mouse' ? <Mouse className="w-4 h-4 text-rose-400" /> : <Keyboard className="w-4 h-4 text-rose-400" />}
                      <span>{isDeafenRecording ? 'Ожидание нажатия...' : deafenHotkey.label}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        cancelMuteRecording();
                        if (isDeafenRecording) {
                          cancelDeafenRecording();
                        } else {
                          startDeafenRecording();
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex-1 sm:flex-none cursor-pointer ${
                        isDeafenRecording
                          ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                          : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                      }`}
                    >
                      {isDeafenRecording ? 'Отмена' : 'Назначить'}
                    </button>
                    <Tooltip content="Сбросить хоткей" description="Сбросить звук на клавишу \" position="top">
                      <button
                        type="button"
                        onClick={resetDeafenHotkey}
                        className="px-2.5 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                      >
                        Сброс (\)
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {MOUSE_HOTKEY_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        updateDeafenHotkey(opt);
                        cancelDeafenRecording();
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all truncate text-center cursor-pointer ${
                        deafenHotkey.type === 'mouse' && deafenHotkey.code === opt.code
                          ? 'bg-rose-600/30 border-rose-500 text-rose-300 font-semibold shadow-sm'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {isDeafenRecording && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs animate-fade-in text-center leading-relaxed">
                    Нажмите <strong>любую клавишу</strong> на клавиатуре или <strong>кнопку мыши</strong> для полного отключения...
                  </div>
                )}
              </div>

              {/* Document Picture-in-Picture Section */}
              <div className="space-y-2 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AppWindow className="w-4 h-4 text-blue-400" />
                    <h4 className="font-semibold text-xs sm:text-sm">Оверлей поверх всех окон (PiP)</h4>
                  </div>
                  {isPipSupported && (
                    <button
                      type="button"
                      onClick={togglePip}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        pipWindow
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                      }`}
                    >
                      {pipWindow ? 'Закрыть' : 'Открыть'}
                    </button>
                  )}
                </div>

                {isPipSupported ? (
                  <p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed">
                    Открывает плавающее мини-окно поверх всех программ и игр со статусом микрофона и звука.
                  </p>
                ) : (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-300 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span>PiP не поддерживается текущим браузером</span>
                    </div>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      Для плавающего оверлея поверх окон используйте Google Chrome, Edge или Яндекс.Браузер.
                    </p>
                  </div>
                )}
              </div>

              {/* Desktop Mode or Browser Info */}
              {isDesktop ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-200 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-emerald-300 text-xs">
                    <Monitor className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Десктоп-режим активен (Tauri)</span>
                  </div>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    Хоткеи <strong>[{muteHotkey.label}]</strong> и <strong>[{deafenHotkey.label}]</strong> работают глобально на уровне Windows — в любых полноэкранных играх и свёрнутом приложении!
                  </p>
                </div>
              ) : (
                <div className="p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-gray-300 text-xs space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5 text-xs">
                    <Shield className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span>Фоновый режим:</span>
                  </p>
                  <p className="text-gray-400 text-[11px] leading-relaxed">
                    Браузеры блокируют глобальные хоткеи в фоне для безопасности. Для фонового управления используйте кнопку Mute на гарнитуре или десктопное приложение.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end p-3 sm:p-4 border-t border-white/10 flex-shrink-0 bg-slate-950/50 rounded-b-2xl">
          <button
            type="button"
            onClick={() => {
              cancelMuteRecording();
              cancelDeafenRecording();
              setShowSettingsModal(false);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-blue-600/30 active:scale-95 cursor-pointer"
          >
            Готово
          </button>
        </div>
      </Modal>

      {/* Picture-in-Picture Overlay Portal */}
      {pipWindow &&
        createPortal(
          <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-slate-900 select-none text-white">
            <div className="text-[11px] font-semibold text-gray-400 mb-2 truncate max-w-full">
              VoiceChat • {roomId}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                  isMuted
                    ? 'bg-red-700 hover:bg-red-800 shadow-lg shadow-red-900/50 text-white'
                    : 'bg-white/10 hover:bg-white/20 border-2 border-white/30 text-white'
                }`}
                title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              >
                {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>

              <button
                onClick={toggleDeafen}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                  isDeafened
                    ? 'bg-rose-700 hover:bg-rose-800 shadow-lg shadow-rose-900/50 text-white'
                    : 'bg-white/10 hover:bg-white/20 border-2 border-white/30 text-white'
                }`}
                title={isDeafened ? 'Включить звук и микрофон' : 'Полное отключение звука и микрофона'}
              >
                {isDeafened ? <VolumeX className="w-7 h-7" /> : <Headphones className="w-7 h-7" />}
              </button>
            </div>
            <div className="mt-2 text-center">
              <span className={`text-xs font-semibold ${isDeafened ? 'text-rose-400' : isMuted ? 'text-red-400' : 'text-green-400'}`}>
                {isDeafened ? 'Звук и микрофон ВЫКЛ' : isMuted ? 'Микрофон ВЫКЛ' : 'Микрофон ВКЛ'}
              </span>
              <span className="text-[10px] text-gray-400 block font-mono mt-0.5">
                [{muteHotkey.label}] [{deafenHotkey.label}]
              </span>
            </div>
          </div>,
          pipWindow.document.body
        )}
    </>
  );
});

VoiceChatScreen.displayName = 'VoiceChatScreen';
