import React, { memo } from 'react';
import {
  Settings,
  Headphones,
  Keyboard,
  X,
  Info,
  Mic,
  Mouse,
  VolumeX,
  AlertTriangle,
  Monitor,
  Shield,
} from 'lucide-react';
import { Modal } from '../Modal';
import { Tooltip } from '../Tooltip';
import { AudioDeviceSettings } from '../AudioDeviceSettings';
import { useAudioDevices } from '../../hooks/useAudioDevices';
import { MOUSE_HOTKEY_OPTIONS, type HotkeyConfig } from '../../hooks/useHotkey';
import { UpdateBadge } from '../updater/UpdateBadge';
import { APP_VERSION } from '../../config';

export interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSmartphone: boolean;
  settingsTab: 'audio' | 'hotkeys';
  setSettingsTab: (tab: 'audio' | 'hotkeys') => void;
  deviceState?: ReturnType<typeof useAudioDevices>;
  hotkeyConflictNotice: string | null;
  onCloseConflictNotice: () => void;
  muteHotkey: HotkeyConfig;
  isMuteRecording: boolean;
  startMuteRecording: () => void;
  cancelMuteRecording: () => void;
  resetMuteHotkey: () => void;
  updateMuteHotkey: (cfg: HotkeyConfig) => void;
  deafenHotkey: HotkeyConfig;
  isDeafenRecording: boolean;
  startDeafenRecording: () => void;
  cancelDeafenRecording: () => void;
  resetDeafenHotkey: () => void;
  updateDeafenHotkey: (cfg: HotkeyConfig) => void;
  isDesktop: boolean;
  onCheckUpdates?: () => void;
  hasUpdate?: boolean;
  updateVersion?: string;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = memo(({
  isOpen,
  onClose,
  isSmartphone,
  settingsTab,
  setSettingsTab,
  deviceState,
  hotkeyConflictNotice,
  onCloseConflictNotice,
  muteHotkey,
  isMuteRecording,
  startMuteRecording,
  cancelMuteRecording,
  resetMuteHotkey,
  updateMuteHotkey,
  deafenHotkey,
  isDeafenRecording,
  startDeafenRecording,
  cancelDeafenRecording,
  resetDeafenHotkey,
  updateDeafenHotkey,
  isDesktop,
  onCheckUpdates,
  hasUpdate,
  updateVersion,
}) => {
  const effectiveTab = isSmartphone ? 'audio' : settingsTab;

  const handleClose = () => {
    cancelMuteRecording();
    cancelDeafenRecording();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-lg">
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
                {isSmartphone
                  ? 'Выбор микрофона и динамиков'
                  : 'Управление звуком, микрофоном и клавишами'}
              </p>
            </div>
          </div>
          <Tooltip content="Закрыть" position="bottom">
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        {/* Segmented Tab Switcher (hidden on smartphones) */}
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
                    onClick={onCloseConflictNotice}
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
                    {muteHotkey.type === 'mouse' ? (
                      <Mouse className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Keyboard className="w-4 h-4 text-blue-400" />
                    )}
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
                    {deafenHotkey.type === 'mouse' ? (
                      <Mouse className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Keyboard className="w-4 h-4 text-rose-400" />
                    )}
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

      <div className="flex items-center justify-between p-3 sm:p-4 border-t border-white/10 flex-shrink-0 bg-slate-950/50 rounded-b-2xl">
        <div className="flex items-center gap-2">
          {hasUpdate && updateVersion ? (
            <UpdateBadge
              version={updateVersion}
              onClick={() => {
                onClose();
                onCheckUpdates?.();
              }}
            />
          ) : onCheckUpdates ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCheckUpdates();
              }}
              className="text-[11px] text-gray-400 hover:text-blue-400 flex items-center gap-1.5 transition-colors cursor-pointer font-mono"
            >
              <span>v{APP_VERSION}</span>
              <span className="text-[10px] text-gray-500 font-sans">(Проверить обновления)</span>
            </button>
          ) : (
            <span className="text-[11px] text-gray-500 font-mono">v{APP_VERSION}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-blue-600/30 active:scale-95 cursor-pointer"
        >
          Готово
        </button>
      </div>
    </Modal>
  );
});

VoiceSettingsModal.displayName = 'VoiceSettingsModal';
