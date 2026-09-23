import React, { useState } from 'react';
import { Settings2, ChevronDown, Dices, Mic, LogIn, Lock } from 'lucide-react';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { AudioDeviceSettings } from './AudioDeviceSettings';
import { extractRoomId } from '../utils/nicknames';
import { APP_VERSION } from '../config';
import { Tooltip } from './Tooltip';
import { JellyBackground } from './JellyBackground';

interface LobbyScreenProps {
  nickname: string;
  setNickname: (name: string) => void;
  mode: 'create' | 'join';
  setMode: (mode: 'create' | 'join') => void;
  joinRoomId: string;
  setJoinRoomId: (id: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  deviceState?: ReturnType<typeof useAudioDevices>;
  onCheckUpdates?: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
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

  return (
    <>
      {/* Jelly Background */}
      <JellyBackground />

      {/* Content */}
      <div className="content-wrapper h-full w-full flex-1 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="max-w-md w-full">
          {/* Logo / Title */}
          <div className="text-center mb-4 sm:mb-6 compact-h-header">
            <div className="flex flex-col items-center compact-h-row">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-18 sm:h-18 compact-h-icon rounded-full bg-gradient-to-r from-blue-700 to-blue-900 mb-3 sm:mb-4 shadow-lg shadow-blue-900/50 flex-shrink-0 transition-all">
                <svg className="w-7 h-7 sm:w-9 sm:h-9 text-white transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-0.5 compact-h-title transition-all">
                  VoiceChat
                </h1>
                <p className="text-gray-400 text-xs sm:text-sm compact-h-hide">
                  Голосовой чат в браузере
                </p>
              </div>
            </div>
          </div>

          {/* Nickname Card */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 sm:p-5 mb-3 sm:mb-4 border border-white/10 compact-h-card animate-bounce-in">
            <div className="text-center">
              <p className="text-gray-400 text-xs sm:text-sm mb-1.5">Ваш никнейм</p>
              <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    const val = e.target.value.substring(0, 24);
                    setNickname(val);
                    try {
                      sessionStorage.setItem('voicechat-nickname', val);
                    } catch {}
                  }}
                  placeholder="Введите никнейм"
                  maxLength={24}
                  className="w-full py-2 px-3 compact-h-input bg-white/10 border border-white/20 rounded-xl text-center text-white font-bold text-base sm:text-lg placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
                />
                  <Tooltip
                    content="Случайный никнейм"
                    description="Сгенерировать случайное имя"
                    position="top"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const adjectives = ['Быстрый', 'Тихий', 'Мудрый', 'Смелый', 'Весёлый', 'Добрый', 'Храбрый', 'Ловкий', 'Грозный', 'Спокойный', 'Яркий', 'Тёмный', 'Золотой', 'Серебряный', 'Огненный'];
                        const animals = ['Волк', 'Тигр', 'Орёл', 'Дракон', 'Феникс', 'Лев', 'Медведь', 'Ястреб', 'Пантера', 'Лис', 'Кот', 'Пёс', 'Сова', 'Дельфин', 'Кит'];
                        const newNick = `${adjectives[Math.floor(Math.random() * adjectives.length)]}${animals[Math.floor(Math.random() * animals.length)]}${Math.floor(Math.random() * 100)}`;
                        setNickname(newNick);
                        try {
                          sessionStorage.setItem('voicechat-nickname', newNick);
                        } catch {}
                      }}
                      className="p-2 sm:p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/10 flex-shrink-0 flex items-center justify-center"
                    >
                      <Dices className="w-4 h-4 text-blue-400" />
                    </button>
                  </Tooltip>
              </div>
            </div>
          </div>

          {/* Audio Devices Collapsible Card */}
          {deviceState && (
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 compact-h-card p-3.5 sm:p-4 mb-3 sm:mb-4 transition-all animate-bounce-in">
              <button
                type="button"
                onClick={() => setShowAudioSettings(!showAudioSettings)}
                className="w-full flex items-center justify-between text-left group"
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
                className={`grid transition-all duration-300 ease-in-out ${
                  showAudioSettings
                    ? 'grid-rows-[1fr] opacity-100 pt-3 mt-3 border-t border-white/10'
                    : 'grid-rows-[0fr] opacity-0 pt-0 mt-0 border-t-0'
                }`}
              >
                <div className="overflow-hidden">
                  <AudioDeviceSettings deviceState={deviceState} compact />
                </div>
              </div>
            </div>
          )}

          {/* Mode Selection */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 sm:p-5 border border-white/10 compact-h-card animate-slide-up">
            <div className="flex gap-2 mb-3 sm:mb-4">
              <button
                onClick={() => setMode('create')}
                className={`flex-1 py-2.5 sm:py-3 px-4 rounded-xl font-medium transition-all text-xs sm:text-sm ${
                  mode === 'create'
                    ? 'bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg shadow-blue-900/50'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Создать
              </button>
              <button
                onClick={() => setMode('join')}
                className={`flex-1 py-2.5 sm:py-3 px-4 rounded-xl font-medium transition-all text-xs sm:text-sm ${
                  mode === 'join'
                    ? 'bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg shadow-blue-900/50'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Войти
              </button>
            </div>

            {mode === 'create' ? (
              <div className="text-center">
                <p className="text-gray-300 mb-3 text-xs sm:text-sm">
                  Создайте новую комнату и поделитесь ID с друзьями
                </p>
                <button
                  onClick={onCreateRoom}
                  className="w-full py-2.5 sm:py-3.5 px-6 compact-h-btn bg-gradient-to-r from-blue-700 to-blue-900 text-white font-bold rounded-xl hover:from-blue-800 hover:to-blue-950 transition-all shadow-lg shadow-blue-900/50 hover:shadow-blue-900/70 active:scale-95 text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  <span>Создать комнату</span>
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-300 mb-2.5 text-center text-xs sm:text-sm">
                  Введите ID комнаты для присоединения
                </p>
                <input
                  type="text"
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
                  className="w-full py-2.5 px-3 sm:px-4 compact-h-input bg-white/10 border border-white/20 rounded-xl text-white text-center text-base font-mono tracking-wider sm:tracking-widest placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 mb-3 transition-colors"
                  maxLength={128}
                />
                <button
                  onClick={onJoinRoom}
                  disabled={joinRoomId.length < 3}
                  className="w-full py-2.5 sm:py-3.5 px-6 compact-h-btn bg-gradient-to-r from-blue-700 to-blue-900 text-white font-bold rounded-xl hover:from-blue-800 hover:to-blue-950 transition-all shadow-lg shadow-blue-900/50 hover:shadow-blue-900/70 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Присоединиться</span>
                </button>
              </div>
            )}
          </div>

          {/* Info & Version */}
          <div className="mt-3 sm:mt-4 text-center ultra-compact-h-hide flex flex-col items-center gap-1">
            <p className="text-gray-500 text-[11px] sm:text-xs flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3 text-blue-400/70" />
              <span>Peer-to-peer шифрование • Без записи разговоров</span>
            </p>
            {onCheckUpdates && (
              <button
                type="button"
                onClick={onCheckUpdates}
                className="text-[10px] text-gray-500 hover:text-blue-400 font-mono transition-colors"
                title="Нажмите, чтобы проверить наличие обновлений"
              >
                VoiceChat v{APP_VERSION}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
