import React, { useState, useEffect, useCallback, memo } from 'react';
import { Settings2, ChevronDown, Dices, Mic, LogIn, Lock, Sparkles, History, Clock, Trash2 } from 'lucide-react';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { AudioDeviceSettings } from './AudioDeviceSettings';
import { extractRoomId, generateNickname, saveStoredNickname } from '../utils/nicknames';
import {
  getRecentRooms,
  removeRecentRoom,
  clearRecentRooms,
  formatRecentTime,
  type RecentRoom,
} from '../utils/recentRoomsPolicy';
import { APP_VERSION } from '../config';
import { Tooltip } from './Tooltip';
import { JellyBackground } from './JellyBackground';
import { Button, Input, Card, Logo } from './ui';

interface LobbyScreenProps {
  nickname: string;
  setNickname: (name: string) => void;
  mode: 'create' | 'join';
  setMode: (mode: 'create' | 'join') => void;
  joinRoomId: string;
  setJoinRoomId: (id: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (targetRoomId?: string) => void;
  deviceState?: ReturnType<typeof useAudioDevices>;
  onCheckUpdates?: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = memo(({
  nickname,
  setNickname,
  mode,
  setMode,
  joinRoomId,
  setJoinRoomId,
  onCreateRoom,
  onJoinRoom,
  deviceState,
  onCheckUpdates,
}) => {
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>(() => getRecentRooms());

  useEffect(() => {
    setRecentRooms(getRecentRooms());
  }, []);

  const handleQuickJoin = useCallback((id: string) => {
    setJoinRoomId(id);
    onJoinRoom(id);
  }, [onJoinRoom, setJoinRoomId]);

  const handleRemoveRecent = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = removeRecentRoom(id);
    setRecentRooms(updated);
  }, []);

  const handleClearRecent = useCallback(() => {
    clearRecentRooms();
    setRecentRooms([]);
  }, []);

  return (
    <>
      {/* Jelly Background */}
      <JellyBackground />

      {/* Content */}
      <div className="content-wrapper h-full w-full flex-1 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
        <div className="max-w-md w-full">
          {/* Logo / Title */}
          <div className="text-center mb-4 sm:mb-6 compact-h-header">
            <div className="flex flex-col items-center compact-h-row">
              <Logo size="xl" className="mb-3 sm:mb-4 shadow-xl shadow-cyan-950/40 shrink-0 transition-transform hover:scale-105 duration-200" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-0.5 compact-h-title transition-all">
                  RVxis
                </h1>
                <p className="text-gray-400 text-xs sm:text-sm compact-h-hide">
                  Голосовой чат в браузере
                </p>
              </div>
            </div>
          </div>

          {/* Nickname Card */}
          <Card variant="surface" className="mb-3 sm:mb-4 compact-h-card animate-bounce-in">
            <div className="text-center">
              <p className="text-gray-400 text-xs sm:text-sm mb-1.5">Ваш никнейм</p>
              <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                <Input
                  align="center"
                  value={nickname}
                  onChange={(e) => {
                    const val = e.target.value.substring(0, 24);
                    setNickname(val);
                    saveStoredNickname(val);
                  }}
                  placeholder="Введите никнейм"
                  maxLength={24}
                  className="font-bold text-base sm:text-lg compact-h-input"
                />
                <Tooltip
                  content="Случайный никнейм"
                  description="Сгенерировать случайное имя"
                  position="top"
                >
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => {
                      const newNick = generateNickname();
                      setNickname(newNick);
                      saveStoredNickname(newNick);
                    }}
                    className="shrink-0"
                    icon={<Dices className="w-4 h-4 text-[var(--accent)]" />}
                  />
                </Tooltip>
              </div>
            </div>
          </Card>

          {/* Audio Devices Collapsible Card */}
          {deviceState && (
            <Card variant="surface" className="compact-h-card mb-3 sm:mb-4 transition-all animate-bounce-in">
              <button
                type="button"
                onClick={() => setShowAudioSettings(!showAudioSettings)}
                className="w-full flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-semibold text-xs sm:text-sm group-hover:text-blue-300 transition-colors">
                    Настройка звуковых устройств
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 group-hover:text-white transition-colors">
                  <span className="text-[11px] font-medium text-gray-400">
                    {showAudioSettings ? 'Скрыть' : 'Настроить'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transform transition-transform duration-200 ${showAudioSettings ? 'rotate-180' : ''}`} />
                </div>
              </button>
              <div
                className={`grid transition-all duration-300 ease-in-out ${showAudioSettings
                  ? 'grid-rows-[1fr] opacity-100 pt-3 mt-3 border-t border-white/10'
                  : 'grid-rows-[0fr] opacity-0 pt-0 mt-0 border-t-0'
                  }`}
              >
                <div className="overflow-hidden">
                  <AudioDeviceSettings deviceState={deviceState} compact />
                </div>
              </div>
            </Card>
          )}

          {/* Mode Selection */}
          <Card variant="surface" className="compact-h-card animate-slide-up">
            <div className="flex gap-2 mb-3 sm:mb-3.5">
              <Button
                variant={mode === 'create' ? 'primary' : 'secondary'}
                onClick={() => setMode('create')}
                className="flex-1"
              >
                Создать
              </Button>
              <Button
                variant={mode === 'join' ? 'primary' : 'secondary'}
                onClick={() => setMode('join')}
                className="flex-1"
              >
                Войти
              </Button>
            </div>

            {mode === 'create' ? (
              <div key="create" className="animate-tab-fade mode-card-content flex flex-col justify-between">
                <div className="text-center pt-0.5 sm:pt-1">
                  <p className="text-gray-300 text-xs sm:text-sm font-medium">
                    Создайте новую комнату и поделитесь ID с друзьями
                  </p>
                </div>
                <div className="w-full py-2 sm:py-2.5 px-3 sm:px-4 compact-h-slot bg-[var(--elevated)] border border-[var(--border)] rounded-[var(--radius)] flex items-center justify-center gap-2 text-[var(--muted)] text-xs select-none">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                  <span className="truncate">Комната создается мгновенно с P2P шифрованием</span>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={onCreateRoom}
                  icon={<Mic className="w-4 h-4" />}
                  className="w-full compact-h-btn"
                >
                  Создать комнату
                </Button>
              </div>
            ) : (
              <div key="join" className="animate-tab-fade mode-card-content flex flex-col justify-between">
                <div className="text-center pt-0.5 sm:pt-1">
                  <p className="text-gray-300 text-xs sm:text-sm font-medium">
                    Введите ID комнаты для присоединения
                  </p>
                </div>
                <Input
                  align="center"
                  mono
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(extractRoomId(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && joinRoomId.length >= 3) {
                      onJoinRoom();
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text');
                    setJoinRoomId(extractRoomId(text));
                  }}
                  placeholder="ID КОМНАТЫ ИЛИ ССЫЛКА"
                  maxLength={128}
                  className="compact-h-input tracking-wider sm:tracking-widest placeholder:tracking-normal placeholder:font-sans"
                />
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => onJoinRoom()}
                  disabled={joinRoomId.length < 3}
                  icon={<LogIn className="w-4 h-4" />}
                  className="w-full compact-h-btn"
                >
                  Присоединиться
                </Button>
              </div>
            )}

            {/* Recent Visited Rooms: Visible regardless of active tab */}
            {recentRooms.length > 0 && (
              <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)] compact-h-recent">
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] font-medium tracking-wide">
                    <History className="w-3 h-3 text-[var(--accent)] shrink-0" />
                    <span>Недавние комнаты</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    className="text-[10px] text-[var(--muted)] hover:text-rose-400 transition-colors cursor-pointer py-0.5"
                    title="Очистить историю комнат"
                  >
                    Очистить
                  </button>
                </div>

                <div className="w-full flex gap-1.5 sm:gap-2 py-1">
                  {recentRooms.map((room) => (
                    <Card
                      key={room.roomId}
                      level={2}
                      interactive
                      onClick={() => handleQuickJoin(room.roomId)}
                      className="group/chip flex-1 min-w-0 flex flex-col justify-between py-1.5 px-2 sm:px-2.5 hover:border-[var(--accent)]/50 text-[var(--fg)]"
                      title={`Войти в комнату ${room.roomId}`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full min-w-0">
                        <span className="font-mono font-bold text-xs tracking-wider text-[var(--accent)] truncate">
                          {room.roomId}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveRecent(e, room.roomId)}
                          className="w-6 h-6 -mr-1 -mt-0.5 flex items-center justify-center rounded-[var(--radius)] text-[var(--muted)] hover:text-rose-400 hover:bg-rose-500/15 active:scale-90 transition-all shrink-0 cursor-pointer"
                          title="Удалить из истории"
                          aria-label="Удалить комнату из истории"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-[var(--muted)] mt-0.5 min-w-0">
                        <Clock className="w-2.5 h-2.5 text-[var(--muted)] shrink-0" />
                        <span className="truncate">{formatRecentTime(room.lastVisited)}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Info & Version */}
          <div className="mt-3 sm:mt-4 text-center ultra-compact-h-hide flex flex-col items-center gap-1">
            <p className="text-[var(--muted)] text-[11px] sm:text-xs flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3 text-[var(--accent)]" />
              <span>Peer-to-peer шифрование • Без записи разговоров</span>
            </p>
            <p className="text-[var(--muted)] text-[11px] sm:text-xs flex items-center justify-center gap-1.5">
              <span>Проект создан исключительно в учебных целях</span>
            </p>
            {onCheckUpdates && (
              <Tooltip
                content="Проверить обновления"
                description="Нажмите, чтобы проверить наличие новой версии"
                position="top"
              >
                <button
                  type="button"
                  onClick={onCheckUpdates}
                  className="text-[10px] text-[var(--muted)] hover:text-[var(--accent)] font-mono transition-colors cursor-pointer"
                >
                  RVxis v{APP_VERSION}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

LobbyScreen.displayName = 'LobbyScreen';
