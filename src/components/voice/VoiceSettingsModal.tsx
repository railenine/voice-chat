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
        <div className="py-8 text-center text-(--muted) text-xs flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-(--border) border-t-(--accent) rounded-full animate-spin" />
          <span>Инициализация аудиоустройств...</span>
        </div>
      )}
    </div>
  );

  const renderHotkeysContent = () => (
    <div key="hotkeys-tab" className="animate-tab-fade space-y-4">
      {/* Conflict Notification Banner */}
      {hotkeyConflictNotice && (
        <div className="p-3 bg-(--accent-soft) border border-(--accent)/30 rounded-(--radius) text-(--fg) text-xs flex items-start justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-(--accent) shrink-0 mt-0.5" />
            <span className="leading-snug">{hotkeyConflictNotice}</span>
          </div>
          <Tooltip content="Закрыть" position="left">
            <button
              type="button"
              onClick={onCloseConflictNotice}
              className="p-1 text-(--muted) hover:text-(--fg) rounded hover:bg-(--fg-soft) transition-colors flex items-center justify-center cursor-pointer"
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
          <span className="text-xs font-semibold text-(--fg) flex items-center gap-1.5">
            <Mic className="w-4 h-4 text-(--accent)" />
            <span>Включение / выключение микрофона</span>
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-(--elevated) border border-(--border) rounded-(--radius)">
          <div>
            <div className="text-[10px] text-(--muted) uppercase tracking-wider font-semibold">
              Текущая клавиша:
            </div>
            <div className="text-base font-mono font-bold text-(--accent) mt-0.5 flex items-center gap-1.5">
              {muteHotkey.type === 'mouse' ? (
                <Mouse className="w-4 h-4 text-(--accent)" />
              ) : (
                <Keyboard className="w-4 h-4 text-(--accent)" />
              )}
              <span>{isMuteRecording ? 'Ожидание нажатия...' : muteHotkey.label}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={isMuteRecording ? 'danger' : 'primary'}
              size="sm"
              onClick={() => {
                cancelDeafenRecording();
                if (isMuteRecording) {
                  cancelMuteRecording();
                } else {
                  startMuteRecording();
                }
              }}
              className={`flex-1 sm:flex-none font-medium text-xs ${isMuteRecording ? 'animate-pulse' : ''}`}
            >
              {isMuteRecording ? 'Отмена' : 'Назначить'}
            </Button>
            <Tooltip content="Сбросить хоткей" description="Сбросить микрофон на клавишу Ё / `" position="top">
              <Button
                variant="secondary"
                size="sm"
                onClick={resetMuteHotkey}
                className="text-xs px-2.5"
              >
                Сброс (Ё)
              </Button>
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
              className={`px-2 py-1 rounded-(--radius) text-[11px] font-medium border transition-colors truncate text-center cursor-pointer ${
                muteHotkey.type === 'mouse' && muteHotkey.code === opt.code
                  ? 'bg-(--accent-soft) border-(--accent) text-(--accent) font-semibold shadow-xs'
                  : 'bg-(--elevated) border-(--border) hover:bg-(--fg-soft) text-(--muted) hover:text-(--fg)'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {isMuteRecording && (
          <div className="p-2 bg-(--elevated) border border-(--accent) rounded-(--radius) text-(--accent) text-xs animate-fade-in text-center leading-relaxed">
            Нажмите <strong>любую клавишу</strong> на клавиатуре или <strong>кнопку мыши</strong> для микрофона...
          </div>
        )}
      </div>

      {/* 2. Deafen Hotkey */}
      <div className="space-y-2 border-t border-(--border) pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-(--fg) flex items-center gap-1.5">
            <VolumeX className="w-4 h-4 text-(--danger)" />
            <span>Полное отключение звука и микрофона (Deafen)</span>
          </span>
        </div>
        <p className="text-[11px] text-(--muted) leading-relaxed">
          Мгновенно заглушает ваш микрофон и весь входящий звук от участников в комнате.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-(--elevated) border border-(--border) rounded-(--radius)">
          <div>
            <div className="text-[10px] text-(--muted) uppercase tracking-wider font-semibold">
              Текущая клавиша:
            </div>
            <div className="text-base font-mono font-bold text-(--danger) mt-0.5 flex items-center gap-1.5">
              {deafenHotkey.type === 'mouse' ? (
                <Mouse className="w-4 h-4 text-(--danger)" />
              ) : (
                <Keyboard className="w-4 h-4 text-(--danger)" />
              )}
              <span>{isDeafenRecording ? 'Ожидание нажатия...' : deafenHotkey.label}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={isDeafenRecording ? 'secondary' : 'danger'}
              size="sm"
              onClick={() => {
                cancelMuteRecording();
                if (isDeafenRecording) {
                  cancelDeafenRecording();
                } else {
                  startDeafenRecording();
                }
              }}
              className={`flex-1 sm:flex-none font-medium text-xs ${isDeafenRecording ? 'animate-pulse' : ''}`}
            >
              {isDeafenRecording ? 'Отмена' : 'Назначить'}
            </Button>
            <Tooltip content="Сбросить хоткей" description="Сбросить звук на клавишу \" position="top">
              <Button
                variant="secondary"
                size="sm"
                onClick={resetDeafenHotkey}
                className="text-xs px-2.5"
              >
                Сброс (\)
              </Button>
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
              className={`px-2 py-1 rounded-(--radius) text-[11px] font-medium border transition-colors truncate text-center cursor-pointer ${
                deafenHotkey.type === 'mouse' && deafenHotkey.code === opt.code
                  ? 'bg-(--danger-soft) border-(--danger) text-(--danger) font-semibold shadow-xs'
                  : 'bg-(--surface) border-(--border) hover:bg-(--fg-soft) text-(--muted) hover:text-(--fg)'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {isDeafenRecording && (
          <div className="p-2 bg-(--surface) border border-(--danger-border) rounded-(--radius) text-(--danger) text-xs animate-fade-in text-center leading-relaxed">
            Нажмите <strong>любую клавишу</strong> на клавиатуре или <strong>кнопку мыши</strong> для полного отключения...
          </div>
        )}
      </div>

      {/* Desktop Mode or Browser Info */}
      {isDesktop ? (
        <div className="p-3 bg-(--surface) border border-(--border) rounded-(--radius) text-(--fg) text-xs space-y-1">
          <div className="flex items-center gap-2 font-semibold text-(--accent) text-xs">
            <Monitor className="w-4 h-4 text-(--accent) shrink-0" />
            <span>Десктоп-режим активен (Tauri)</span>
          </div>
          <p className="text-(--muted) text-[11px] leading-relaxed">
            Хоткеи <strong>[{muteHotkey.label}]</strong> и <strong>[{deafenHotkey.label}]</strong> работают глобально на уровне Windows — в любых полноэкранных играх и свёрнутом приложении!
          </p>
        </div>
      ) : (
        <div className="p-2.5 bg-(--elevated) border border-(--border) rounded-(--radius) text-(--fg) text-xs space-y-1">
          <p className="font-semibold text-(--fg) flex items-center gap-1.5 text-xs">
            <Shield className="w-4 h-4 text-(--accent) shrink-0" />
            <span>Фоновый режим:</span>
          </p>
          <p className="text-(--muted) text-[11px] leading-relaxed">
            Браузеры блокируют глобальные хоткеи в фоне для безопасности. Для фонового управления используйте кнопку Mute на гарнитуре или десктопное приложение.
          </p>
        </div>
      )}
    </div>
  );

  const renderAboutContent = () => (
    <div key="about-tab" className="animate-tab-fade space-y-4">
      {/* 1. App Header & Version */}
      <div className="p-4 bg-(--elevated) border border-(--border) rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size="lg" className="rounded-(--radius) shadow-xs" />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-base text-(--fg) tracking-wide">RVxis</h4>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-(--radius) bg-(--accent-soft) border border-(--accent)/30 text-(--accent) font-semibold">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-(--muted) mt-0.5">
              Легковесный голосовой чат для совместных игр и общения
            </p>
          </div>
        </div>

        {/* Update action / status */}
        <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-(--border) shrink-0">
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
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onCheckUpdates();
              }}
              icon={<RefreshCw className="w-3.5 h-3.5 text-(--accent)" />}
            >
              Проверить обновления
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-(--accent) bg-(--accent-soft) border border-(--accent)/30 px-2.5 py-1 rounded-(--radius)">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Последняя версия</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Platform & Engine Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Platform Card */}
        <div className="p-3.5 bg-(--elevated) border border-(--border) rounded-(--radius) space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-(--radius) bg-(--accent-soft) border border-(--accent)/30 flex items-center justify-center text-(--accent)">
              {isDesktop ? <Monitor className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
            </div>
            <span className="text-xs font-semibold text-(--fg)">
              {isDesktop ? 'Десктоп-версия (Tauri v2)' : 'Веб-версия (Браузер)'}
            </span>
          </div>
          <p className="text-[11px] text-(--muted) leading-relaxed">
            {isDesktop
              ? 'Глобальные горячие клавиши в полноэкранных играх, автообновления и минимальное потребление ресурсов.'
              : 'Работает прямо во вкладке браузера без установки дополнительных программ через стандарт WebRTC.'}
          </p>
        </div>

        {/* Audio Engine Card */}
        <div className="p-3.5 bg-(--elevated) border border-(--border) rounded-(--radius) space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-(--radius) bg-(--accent-soft) border border-(--accent)/30 flex items-center justify-center text-(--accent)">
              <Headphones className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-(--fg)">Аудиодвижок WebRTC</span>
          </div>
          <p className="text-[11px] text-(--muted) leading-relaxed">
            Широкополосный кодек OPUS с ультранизкой задержкой, адаптивное шумоподавление и эхоподавление.
          </p>
        </div>
      </div>

      {/* 3. Security & Privacy Card */}
      <div className="p-3.5 bg-(--elevated) border border-(--border) rounded-(--radius) space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-(--radius) bg-(--accent-soft) border border-(--accent)/30 flex items-center justify-center text-(--accent)">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-(--fg)">Безопасность и приватность</span>
        </div>
        <p className="text-[11px] text-(--muted) leading-relaxed">
          Все голосовые потоки защищены сквозным шифрованием DTLS-SRTP. Данные передаются напрямую между участниками и медиа-сервером без записи или передачи сторонним сервисам.
        </p>
      </div>
    </div>
  );

  // 1. Mobile smartphone popup: Single-column modal on tokens
  if (isSmartphone) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} className="max-w-lg">
        <div className="border-b border-(--border) p-4 sm:p-5 shrink-0 bg-(--surface)">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-(--radius) bg-(--accent-soft) border border-(--accent)/30 flex items-center justify-center text-(--accent)">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base leading-snug text-(--fg)">
                  Настройки звука
                </h3>
                <p className="text-[11px] text-(--muted)">
                  Выбор микрофона и динамиков
                </p>
              </div>
            </div>
            <Tooltip content="Закрыть" position="bottom">
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 text-(--muted) hover:text-(--fg) rounded-(--radius) hover:bg-(--fg-soft) transition-colors flex items-center justify-center cursor-pointer"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="modal-content-scroll p-4 sm:p-5 bg-(--bg)/50">
          {renderAudioContent()}
        </div>

        <div className="flex items-center justify-between p-3 sm:p-4 border-t border-(--border) shrink-0 bg-(--surface) rounded-b-[calc(var(--radius)+4px)]">
          <span className="text-[11px] text-(--muted) font-mono">v{APP_VERSION}</span>
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
      <div className="sm:hidden border-b border-(--border) p-3.5 bg-(--surface) shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-(--radius) bg-(--accent-soft) border border-(--accent)/30 flex items-center justify-center text-(--accent)">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-(--fg)">Настройки</h3>
              <p className="text-[11px] text-(--muted)">
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
              className="p-1.5 text-(--muted) hover:text-(--fg) rounded-(--radius) hover:bg-(--fg-soft) transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        {/* Top Segmented Tab Switcher for <sm */}
        <div className="flex items-center p-1 bg-(--elevated) border border-(--border) rounded-(--radius) gap-1">
          <button
            type="button"
            onClick={() => {
              cancelMuteRecording();
              cancelDeafenRecording();
              setSettingsTab('audio');
            }}
            className={`flex-1 py-1.5 px-2 rounded-[calc(var(--radius)-2px)] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              settingsTab === 'audio'
                ? 'bg-(--accent) text-(--bg) font-semibold shadow-xs'
                : 'text-(--muted) hover:text-(--fg) hover:bg-(--fg-soft)'
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
            className={`flex-1 py-1.5 px-2 rounded-[calc(var(--radius)-2px)] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              settingsTab === 'hotkeys'
                ? 'bg-(--accent) text-(--bg) font-semibold shadow-xs'
                : 'text-(--muted) hover:text-(--fg) hover:bg-(--fg-soft)'
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
            className={`flex-1 py-1.5 px-2 rounded-[calc(var(--radius)-2px)] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer relative ${
              settingsTab === 'about'
                ? 'bg-(--accent) text-(--bg) font-semibold shadow-xs'
                : 'text-(--muted) hover:text-(--fg) hover:bg-(--fg-soft)'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Инфо</span>
            {hasUpdate && (
              <span className="w-1.5 h-1.5 rounded-full bg-(--accent) animate-pulse absolute top-1.5 right-1.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Container: Row on >=sm, Column on <sm */}
      <div className="flex flex-1 min-h-0 w-full">
        {/* Left Sidebar Menu (visible only on >=sm) */}
        <div className="hidden sm:flex w-48 sm:w-52 shrink-0 bg-(--surface) border-r border-(--border) flex-col p-3.5 sm:p-4">
          {/* Sidebar Title */}
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-3 sm:mb-4">
            <div className="w-7 h-7 rounded-(--radius) bg-(--accent-soft) border border-(--accent)/30 flex items-center justify-center text-(--accent)">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-(--fg) block">Настройки</span>
              <span className="text-[10px] text-(--muted) block">Конфигурация</span>
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
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-(--radius) text-xs font-medium transition-colors text-left cursor-pointer ${
                settingsTab === 'audio'
                  ? 'bg-(--accent-soft) text-(--accent) font-semibold border border-(--accent)/30 shadow-xs'
                  : 'text-(--muted) hover:text-(--fg) hover:bg-(--fg-soft) border border-transparent'
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
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-(--radius) text-xs font-medium transition-colors text-left cursor-pointer ${
                settingsTab === 'hotkeys'
                  ? 'bg-(--accent-soft) text-(--accent) font-semibold border border-(--accent)/30 shadow-xs'
                  : 'text-(--muted) hover:text-(--fg) hover:bg-(--fg-soft) border border-transparent'
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-(--radius) text-xs font-medium transition-colors text-left cursor-pointer ${
                settingsTab === 'about'
                  ? 'bg-(--accent-soft) text-(--accent) font-semibold border border-(--accent)/30 shadow-xs'
                  : 'text-(--muted) hover:text-(--fg) hover:bg-(--fg-soft) border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Info className="w-4 h-4 shrink-0" />
                <span className="truncate">О программе</span>
              </div>
              {hasUpdate && (
                <span className="w-2 h-2 rounded-full bg-(--accent) animate-pulse shrink-0 ml-1.5" />
              )}
            </button>
          </div>
        </div>

        {/* Right Content Area (spans 100% on <sm, and flex-1 on >=sm) */}
        <div className="flex-1 min-w-0 flex flex-col h-full bg-(--surface)">
          {/* Header on >=sm with Category Title & Close button */}
          <div className="hidden sm:flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-(--border) shrink-0 bg-(--surface)">
            <div>
              <h3 className="font-bold text-sm text-(--fg)">
                {settingsTab === 'audio'
                  ? 'Звук и устройства'
                  : settingsTab === 'hotkeys'
                    ? 'Горячие клавиши'
                    : 'О программе RVxis'}
              </h3>
              <p className="text-[11px] text-(--muted)">
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
                className="p-1.5 text-(--muted) hover:text-(--fg) rounded-(--radius) hover:bg-(--fg-soft) transition-colors flex items-center justify-center cursor-pointer"
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
          <div className="flex items-center justify-end px-4 sm:px-6 py-3 border-t border-(--border) shrink-0 bg-(--surface)">
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
