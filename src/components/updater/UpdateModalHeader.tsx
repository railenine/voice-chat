import React, { memo } from 'react';
import { RefreshCw, AlertTriangle, Rocket, X, CheckCircle2, WifiOff, HardDriveDownload } from 'lucide-react';
import { UpdateInfo, UpdateStatus } from '../../utils/updaterTypes';
import { APP_VERSION } from '../../config';
import { Tooltip } from '../Tooltip';
import { Button } from '../ui/Button';

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
      case 'available':
      case 'downloading':
      case 'installing':
        return 'bg-(--accent-soft) text-(--accent) border border-(--accent)/30';
      case 'up-to-date':
      case 'downloaded':
      case 'restart-required':
        return 'bg-(--success-soft) text-(--success) border border-(--success-border)';
      case 'error':
        return 'bg-(--danger-soft) text-(--danger) border border-(--danger-border)';
      case 'offline':
      default:
        return 'bg-(--surface) text-(--muted) border border-(--border)';
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
        {/* Status Icon */}
        <div
          className={`w-11 h-11 rounded-(--radius) flex items-center justify-center shrink-0 transition-all duration-300 ease-out ${getIconContainerStyle()}`}
        >
          <div
            className={`transition-all duration-200 ease-out flex items-center justify-center ${
              fadeState === 'fading-out' ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
            }`}
          >
            {status === 'checking' && <RefreshCw className="w-5 h-5 animate-spin" />}
            {status === 'up-to-date' && <CheckCircle2 className="w-5 h-5" />}
            {status === 'offline' && <WifiOff className="w-5 h-5" />}
            {status === 'error' && <AlertTriangle className="w-5 h-5" />}
            {(status === 'downloading' || status === 'installing') && (
              <HardDriveDownload className="w-5 h-5" />
            )}
            {(status === 'downloaded' || status === 'restart-required') && (
              <CheckCircle2 className="w-5 h-5" />
            )}
            {(status === 'available' || status === 'idle' || status === 'cancelled') && (
              <Rocket className="w-5 h-5" />
            )}
          </div>
        </div>

        <div>
          <div
            className={`transition-all duration-200 ease-out ${
              fadeState === 'fading-out' ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'
            }`}
          >
            <h3 className="text-base sm:text-lg font-bold text-(--fg) leading-snug">{getTitle()}</h3>

            {/* Subtitle with version badges */}
            <div className="flex items-center gap-1.5 mt-1 font-mono text-xs flex-wrap">
              {status === 'checking' && (
                <span className="text-(--muted) bg-(--surface) px-2 py-0.5 rounded-(--radius) border border-(--border)">
                  Установлена: v{APP_VERSION}
                </span>
              )}

              {status === 'up-to-date' && (
                <span className="text-(--success) bg-(--success-soft) px-2 py-0.5 rounded-(--radius) border border-(--success-border) font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-(--success)"></span>
                  v{APP_VERSION} — актуально
                </span>
              )}

              {status === 'offline' && (
                <span className="text-(--muted) bg-(--surface) px-2 py-0.5 rounded-(--radius) border border-(--border)">
                  v{APP_VERSION} (офлайн-режим)
                </span>
              )}

              {status === 'error' && (
                <span className="text-(--danger) bg-(--danger-soft) px-2 py-0.5 rounded-(--radius) border border-(--danger-border)">
                  Сбой проверки
                </span>
              )}

              {(status === 'available' ||
                status === 'downloading' ||
                status === 'downloaded' ||
                status === 'installing' ||
                status === 'restart-required') && (
                <>
                  <span className="text-(--muted) bg-(--surface) px-2 py-0.5 rounded-(--radius) border border-(--border)">
                    v{updateInfo?.currentVersion || APP_VERSION}
                  </span>
                  <span className="text-(--muted)">→</span>
                  <span className="text-(--accent) font-bold bg-(--accent-soft) px-2 py-0.5 rounded-(--radius) border border-(--accent)/30">
                    v{updateInfo?.version}
                  </span>
                  {isDesktop && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-(--radius) bg-(--surface) text-(--muted) border border-(--border) font-sans">
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
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-(--muted) hover:text-(--fg) -mr-1 -mt-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </Tooltip>
      )}
    </div>
  );
});

UpdateModalHeader.displayName = 'UpdateModalHeader';
