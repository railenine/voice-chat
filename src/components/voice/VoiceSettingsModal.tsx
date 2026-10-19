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
  Monitor,
  Shield,
  Radio,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../Modal';
import { Button, Logo } from '../ui';
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
  settingsTab: 'audio' | 'hotkeys' | 'about';
  setSettingsTab: (tab: 'audio' | 'hotkeys' | 'about') => void;
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

  const renderAudioContent = () => (
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
  );

  const renderHotkeysContent = () => (
    <div key="hotkeys-tab" className="animate-tab-fade space-y-4">
      {/* Conflict Notification Banner */}
      {hotkeyConflictNotice && (
        <div className="p-3 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-200 text-xs flex items-start justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-white/4 border border-white/10 rounded-xl">
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
                className="px-2.5 py-1.5 bg-white/6 hover:bg-white/12 text-gray-300 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
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
                  : 'bg-white/4 border-white/10 hover:bg-white/8 text-gray-300'
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-white/4 border border-white/10 rounded-xl">
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
                className="px-2.5 py-1.5 bg-white/6 hover:bg-white/12 text-gray-300 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
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
                  : 'bg-white/4 border-white/10 hover:bg-white/8 text-gray-300'
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
            <Monitor className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Десктоп-режим активен (Tauri)</span>
          </div>
          <p className="text-gray-300 text-[11px] leading-relaxed">
            Хоткеи <strong>[{muteHotkey.label}]</strong> и <strong>[{deafenHotkey.label}]</strong> работают глобально на уровне Windows — в любых полноэкранных играх и свёрнутом приложении!
          </p>
        </div>
      ) : (
        <div className="p-2.5 bg-white/4 border border-white/10 rounded-xl text-gray-300 text-xs space-y-1">
          <p className="font-semibold text-white flex items-center gap-1.5 text-xs">
            <Shield className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Фоновый режим:</span>
          </p>
          <p className="text-gray-400 text-[11px] leading-relaxed">
            Браузеры блокируют глобальные хоткеи в фоне для безопасности. Для фонового управления используйте кнопку Mute на гарнитуре или десктопное приложение.
          </p>
        </div>
      )}
    </div>
  );

  const renderAboutContent = () => (
    <div key="about-tab" className="animate-tab-fade space-y-4">
      {/* 1. App Header & Version */}
      <div className="p-4 bg-linear-to-br from-blue-900/20 via-slate-900/40 to-indigo-900/10 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size="lg" className="rounded-xl shadow-xs" />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-base text-white tracking-wide">RVxis</h4>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 font-semibold">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Легковесный голосовой чат для совместных игр и общения
            </p>
          </div>
        </div>

        {/* Update action / status */}
        <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0">
          {hasUpdate && updateVersion ? (
            <UpdateBadge
              version={updateVersion}
              onClick={() => {
                onClose();
                onCheckUpdates?.();
              }}
            />
          ) : onCheckUpdates ? (
            <Button
              variant="glass"
              size="sm"
              onClick={() => {
                onClose();
                onCheckUpdates();
              }}
              icon={<RefreshCw className="w-3.5 h-3.5 text-blue-400" />}
            >
              Проверить обновления
            </Button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Последняя версия</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Platform & Engine Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Platform Card */}
        <div className="p-3.5 bg-white/3 border border-white/10 rounded-xl space-y-1.5">
          <div className="flex items-center gap-2">
            {isDesktop ? (
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Monitor className="w-3.5 h-3.5" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Shield className="w-3.5 h-3.5" />
              </div>
            )}
            <span className="text-xs font-semibold text-white">
              {isDesktop ? 'Десктоп-версия (Tauri v2)' : 'Веб-версия (Браузер)'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            {isDesktop
              ? 'Глобальные горячие клавиши в полноэкранных играх, автообновления и минимальное потребление ресурсов.'
              : 'Работает прямо во вкладке браузера без установки дополнительных программ через стандарт WebRTC.'}
          </p>
        </div>

        {/* Audio Engine Card */}
        <div className="p-3.5 bg-white/3 border border-white/10 rounded-xl space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Headphones className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-white">Аудиодвижок WebRTC</span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Широкополосный кодек OPUS с ультранизкой задержкой, адаптивное шумоподавление и эхоподавление.
          </p>
        </div>
      </div>

      {/* 3. Security & Privacy Card */}
      <div className="p-3.5 bg-white/3 border border-white/10 rounded-xl space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-white">Безопасность и приватность</span>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Все голосовые потоки защищены сквозным шифрованием DTLS-SRTP. Данные передаются напрямую между участниками и медиа-сервером без записи или передачи сторонним сервисам.
        </p>
      </div>
    </div>
  );

  // 1. Mobile smartphone popup: Keep existing single-column sound settings modal intact
  if (isSmartphone) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} className="max-w-lg">
        <div className="border-b border-white/10 p-4 sm:p-5 shrink-0 bg-white/2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base leading-snug">
                  Настройки звука
                </h3>
                <p className="text-[11px] text-gray-400">
                  Выбор микрофона и динамиков
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
        </div>

        <div className="modal-content-scroll p-4 sm:p-5">
          {renderAudioContent()}
        </div>

        <div className="flex items-center justify-between p-3 sm:p-4 border-t border-white/10 shrink-0 bg-slate-950/50 rounded-b-2xl">
          <span className="text-[11px] text-gray-500 font-mono">v{APP_VERSION}</span>
          <Button variant="primary" size="md" onClick={handleClose}>
            Готово
          </Button>
        </div>
      </Modal>
    );
  }

  // 2. Desktop layout: Two-column modal on >=sm, switching to top tabs on <sm
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-3xl w-full h-[min(560px,calc(100vh-2.5rem))] p-0 overflow-hidden flex flex-col"
    >
      {/* Mobile / Narrow Desktop Header (<sm only): Title + Close + Top Tabs */}
      <div className="sm:hidden border-b border-white/10 p-3.5 bg-white/2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Настройки</h3>
              <p className="text-[11px] text-gray-400">
                {settingsTab === 'audio'
                  ? 'Звук и микрофон'
                  : settingsTab === 'hotkeys'
                    ? 'Горячие клавиши'
                    : 'О программе'}
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

        {/* Top Segmented Tab Switcher for <sm */}
        <div className="flex items-center p-1 bg-white/4 border border-white/10 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => {
              cancelMuteRecording();
              cancelDeafenRecording();
              setSettingsTab('audio');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              settingsTab === 'audio'
                ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                : 'text-gray-400 hover:text-white hover:bg-white/6'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Звук</span>
          </button>
          <button
            type="button"
            onClick={() => {
              cancelMuteRecording();
              cancelDeafenRecording();
              setSettingsTab('hotkeys');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              settingsTab === 'hotkeys'
                ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                : 'text-gray-400 hover:text-white hover:bg-white/6'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Клавиши</span>
          </button>
          <button
            type="button"
            onClick={() => {
              cancelMuteRecording();
              cancelDeafenRecording();
              setSettingsTab('about');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
              settingsTab === 'about'
                ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                : 'text-gray-400 hover:text-white hover:bg-white/6'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Инфо</span>
            {hasUpdate && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse absolute top-1.5 right-1.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Container: Row on >=sm, Column on <sm */}
      <div className="flex flex-1 min-h-0 w-full">
        {/* Left Sidebar Menu (visible only on >=sm) */}
        <div className="hidden sm:flex w-48 sm:w-52 shrink-0 bg-slate-900/40 border-r border-white/10 flex-col p-3.5 sm:p-4">
          {/* Sidebar Title */}
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-3 sm:mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block">Настройки</span>
              <span className="text-[10px] text-gray-400 block">Конфигурация</span>
            </div>
          </div>

          {/* Vertical Tab Navigation */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                cancelMuteRecording();
                cancelDeafenRecording();
                setSettingsTab('audio');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                settingsTab === 'audio'
                  ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30 shadow-xs'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Headphones className="w-4 h-4 shrink-0" />
              <span>Звук и микрофон</span>
            </button>

            <button
              type="button"
              onClick={() => {
                cancelMuteRecording();
                cancelDeafenRecording();
                setSettingsTab('hotkeys');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                settingsTab === 'hotkeys'
                  ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30 shadow-xs'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Keyboard className="w-4 h-4 shrink-0" />
              <span>Горячие клавиши</span>
            </button>

            <button
              type="button"
              onClick={() => {
                cancelMuteRecording();
                cancelDeafenRecording();
                setSettingsTab('about');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                settingsTab === 'about'
                  ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30 shadow-xs'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Info className="w-4 h-4 shrink-0" />
                <span className="truncate">О программе</span>
              </div>
              {hasUpdate && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 ml-1.5" />
              )}
            </button>
          </div>
        </div>

        {/* Right Content Area (spans 100% on <sm, and flex-1 on >=sm) */}
        <div className="flex-1 min-w-0 flex flex-col h-full bg-slate-950/20">
          {/* Header on >=sm with Category Title & Close button */}
          <div className="hidden sm:flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 shrink-0">
            <div>
              <h3 className="font-bold text-sm text-white">
                {settingsTab === 'audio'
                  ? 'Звук и устройства'
                  : settingsTab === 'hotkeys'
                    ? 'Горячие клавиши'
                    : 'О программе RVxis'}
              </h3>
              <p className="text-[11px] text-gray-400">
                {settingsTab === 'audio'
                  ? 'Выбор и тестирование микрофона, динамиков и шумоподавления'
                  : settingsTab === 'hotkeys'
                    ? 'Настройка быстрых клавиш микрофона и полного глушения'
                    : 'Сведения о приложении, версия и проверка обновлений'}
              </p>
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

          {/* Scrollable Content Body */}
          <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
            {settingsTab === 'audio' && renderAudioContent()}
            {settingsTab === 'hotkeys' && renderHotkeysContent()}
            {settingsTab === 'about' && renderAboutContent()}
          </div>

          {/* Footer of Content Area */}
          <div className="flex items-center justify-end px-4 sm:px-6 py-3 border-t border-white/10 shrink-0 bg-slate-950/40">
            <Button variant="primary" size="md" onClick={handleClose}>
              Готово
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
});

VoiceSettingsModal.displayName = 'VoiceSettingsModal';
