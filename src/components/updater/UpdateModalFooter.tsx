import React, { memo } from 'react';
import { Tooltip } from '../Tooltip';
import { UpdateStatus } from '../../utils/updaterTypes';
import { Button } from '../ui';

interface UpdateModalFooterProps {
  status: UpdateStatus;
  fadeState: 'visible' | 'fading-out' | 'fading-in';
  isDesktop: boolean;
  isPortable: boolean;
  onClose: () => void;
  onInstall: (mode?: 'portable' | 'installer') => void;
  onCheckAgain: () => void;
}

export const UpdateModalFooter: React.FC<UpdateModalFooterProps> = memo(({
  status,
  fadeState,
  isDesktop,
  isPortable,
  onClose,
  onInstall,
  onCheckAgain,
}) => {
  return (
    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-(--border)">
      <div
        className={`flex items-center justify-end gap-2.5 w-full transition-all duration-200 ease-out ${
          fadeState === 'fading-out' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {status === 'checking' && (
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            Отмена
          </Button>
        )}

        {(status === 'available' || status === 'cancelled') && (
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
            >
              Позже
            </Button>

            {isDesktop && isPortable && (
              <Tooltip
                content="Установить в систему"
                description="Скачать и запустить установщик Windows (с ярлыками и записью в список программ)"
                position="top"
              >
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => onInstall('installer')}
                >
                  Установить в систему
                </Button>
              </Tooltip>
            )}

            <Button
              variant="primary"
              size="md"
              onClick={() => onInstall(isPortable ? 'portable' : 'installer')}
            >
              <span>
                {!isDesktop
                  ? 'Обновить страницу'
                  : isPortable
                  ? 'Обновить на месте (Portable)'
                  : 'Обновить сейчас'}
              </span>
              <span>→</span>
            </Button>
          </div>
        )}

        {status === 'downloading' && (
          <Button
            variant="secondary"
            size="md"
            isLoading
            disabled
            className="w-full"
          >
            {isPortable ? 'Загрузка и замена файла...' : 'Установка обновления...'}
          </Button>
        )}

        {status === 'downloaded' && (
          <Button
            variant="success"
            size="md"
            onClick={() => onInstall()}
            className="w-full"
          >
            Перезапустить сейчас
          </Button>
        )}

        {(status === 'installing' || status === 'restart-required') && (
          <Button
            variant="secondary"
            size="md"
            isLoading
            disabled
            className="w-full"
          >
            {status === 'installing' ? 'Применение изменений...' : 'Перезапуск приложения...'}
          </Button>
        )}

        {(status === 'up-to-date' || status === 'error' || status === 'offline') && (
          <>
            {(status === 'error' || status === 'offline') && (
              <Button
                variant="secondary"
                size="md"
                onClick={onCheckAgain}
              >
                Повторить
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={onClose}
            >
              Понятно
            </Button>
          </>
        )}
      </div>
    </div>
  );
});

UpdateModalFooter.displayName = 'UpdateModalFooter';
