import React, { memo } from 'react';
import { Tooltip } from '../Tooltip';
import { UpdateStatus } from '../../utils/updaterTypes';

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
    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
      <div
        className={`flex items-center justify-end gap-2.5 w-full transition-all duration-200 ease-out ${
          fadeState === 'fading-out' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {status === 'checking' && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-all cursor-pointer"
          >
            Отмена
          </button>
        )}

        {(status === 'available' || status === 'cancelled') && (
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-all cursor-pointer"
            >
              Позже
            </button>

            {isDesktop && isPortable && (
              <Tooltip
                content="Установить в систему"
                description="Скачать и запустить установщик Windows (с ярлыками и записью в список программ)"
                position="top"
              >
                <button
                  type="button"
                  onClick={() => onInstall('installer')}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/10 rounded-xl text-xs font-medium transition-all cursor-pointer"
                >
                  Установить в систему
                </button>
              </Tooltip>
            )}

            <button
              type="button"
              onClick={() => onInstall(isPortable ? 'portable' : 'installer')}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/40 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>
                {!isDesktop
                  ? 'Обновить страницу'
                  : isPortable
                  ? 'Обновить на месте (Portable)'
                  : 'Обновить сейчас'}
              </span>
              <span>→</span>
            </button>
          </div>
        )}

        {status === 'downloading' && (
          <button
            disabled
            className="w-full py-2 bg-white/10 text-gray-400 rounded-xl text-xs font-medium cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            <span>{isPortable ? 'Загрузка и замена файла...' : 'Установка обновления...'}</span>
          </button>
        )}

        {status === 'downloaded' && (
          <button
            type="button"
            onClick={() => onInstall()}
            className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-green-600/40 active:scale-95 transition-all cursor-pointer"
          >
            Перезапустить сейчас
          </button>
        )}

        {(status === 'installing' || status === 'restart-required') && (
          <button
            disabled
            className="w-full py-2 bg-cyan-600/50 text-white rounded-xl text-xs font-medium cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            <span>{status === 'installing' ? 'Применение изменений...' : 'Перезапуск приложения...'}</span>
          </button>
        )}

        {(status === 'up-to-date' || status === 'error' || status === 'offline') && (
          <>
            {(status === 'error' || status === 'offline') && (
              <button
                type="button"
                onClick={onCheckAgain}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-medium transition-all cursor-pointer"
              >
                Повторить
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-blue-600/30 cursor-pointer"
            >
              Понятно
            </button>
          </>
        )}
      </div>
    </div>
  );
});

UpdateModalFooter.displayName = 'UpdateModalFooter';
