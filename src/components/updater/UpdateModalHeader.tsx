import React, { memo } from 'react';
import { RefreshCw, AlertTriangle, Rocket, X, CheckCircle2, WifiOff, HardDriveDownload } from 'lucide-react';
import { UpdateInfo, UpdateStatus } from '../../utils/updaterTypes';
import { APP_VERSION } from '../../config';
import { Tooltip } from '../Tooltip';

interface UpdateModalHeaderProps {
  status: UpdateStatus;
  fadeState: 'visible' | 'fading-out' | 'fading-in';
  updateInfo: UpdateInfo | null;
  isDesktop: boolean;
  isPortable: boolean;
  onClose: () => void;
}

export const UpdateModalHeader: React.FC<UpdateModalHeaderProps> = memo(({
  status,
  fadeState,
  updateInfo,
  isDesktop,
  isPortable,
  onClose,
}) => {
  const getIconContainerStyle = () => {
    switch (status) {
      case 'checking':
        return 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/30';
      case 'up-to-date':
        return 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-500/30';
      case 'error':
        return 'bg-gradient-to-tr from-amber-600 to-rose-600 shadow-rose-500/30';
      case 'offline':
        return 'bg-gradient-to-tr from-slate-600 to-zinc-600 shadow-slate-500/30';
      case 'downloading':
      case 'installing':
        return 'bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-cyan-500/30';
      case 'downloaded':
      case 'restart-required':
        return 'bg-gradient-to-tr from-emerald-600 to-cyan-600 shadow-emerald-500/30';
      default:
        return 'bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-purple-500/30';
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'checking':
        return 'Проверка обновлений';
      case 'up-to-date':
        return 'У вас актуальная версия';
      case 'offline':
        return 'Нет подключения к сети';
      case 'error':
        return 'Ошибка обновления';
      case 'downloading':
        return 'Загрузка обновления...';
      case 'downloaded':
        return 'Обновление загружено';
      case 'installing':
        return 'Установка обновления...';
      case 'restart-required':
        return 'Перезапуск приложения';
      case 'cancelled':
        return 'Обновление отложено';
      default:
        return 'Доступно обновление';
    }
  };

  const isLockedProgress = status === 'downloading' || status === 'installing';

  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        {/* Status Icon with Glowing Gradient */}
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-white/20 flex-shrink-0 transition-all duration-500 ease-out ${getIconContainerStyle()}`}
        >
          <div
            className={`transition-all duration-200 ease-out flex items-center justify-center ${
              fadeState === 'fading-out' ? 'opacity-0 scale-75 rotate-[-15deg]' : 'opacity-100 scale-100 rotate-0'
            }`}
          >
            {status === 'checking' && <RefreshCw className="w-6 h-6 animate-spin text-white" />}
            {status === 'up-to-date' && <CheckCircle2 className="w-6 h-6 text-white" />}
            {status === 'offline' && <WifiOff className="w-6 h-6 text-white" />}
            {status === 'error' && <AlertTriangle className="w-6 h-6 text-white" />}
            {(status === 'downloading' || status === 'installing') && (
              <HardDriveDownload className="w-6 h-6 text-white animate-bounce" />
            )}
            {(status === 'downloaded' || status === 'restart-required') && (
              <CheckCircle2 className="w-6 h-6 text-white" />
            )}
            {(status === 'available' || status === 'idle' || status === 'cancelled') && (
              <Rocket className="w-6 h-6 text-white" />
            )}
          </div>
        </div>

        <div>
          <div
            className={`transition-all duration-200 ease-out ${
              fadeState === 'fading-out' ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'
            }`}
          >
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">{getTitle()}</h3>

            {/* Subtitle with version badges */}
            <div className="flex items-center gap-1.5 mt-1 font-mono text-xs">
              {status === 'checking' && (
                <span className="text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  Установлена: v{APP_VERSION}
                </span>
              )}

              {status === 'up-to-date' && (
                <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  v{APP_VERSION} — актуально
                </span>
              )}

              {status === 'offline' && (
                <span className="text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  v{APP_VERSION} (офлайн-режим)
                </span>
              )}

              {status === 'error' && (
                <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  Сбой проверки
                </span>
              )}

              {(status === 'available' ||
                status === 'downloading' ||
                status === 'downloaded' ||
                status === 'installing' ||
                status === 'restart-required') && (
                <>
                  <span className="text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    v{updateInfo?.currentVersion || APP_VERSION}
                  </span>
                  <span className="text-gray-500">→</span>
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    v{updateInfo?.version}
                  </span>
                  {isDesktop && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-sans">
                      {isPortable ? 'Portable' : 'Установлено'}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isLockedProgress && (
        <Tooltip content="Закрыть" position="bottom">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center -mr-1 -mt-1 cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </Tooltip>
      )}
    </div>
  );
});

UpdateModalHeader.displayName = 'UpdateModalHeader';
