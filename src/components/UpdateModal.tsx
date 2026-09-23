import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, AlertTriangle, Rocket } from 'lucide-react';
import { UpdateInfo, UpdateStatus } from '../hooks/useAppUpdater';
import { isTauri } from '../config';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  downloadedBytes: number;
  totalBytes: number;
  error: string | null;
  isPortable?: boolean;
  onInstall: (mode?: 'portable' | 'installer') => void;
  onCheckAgain: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  status,
  updateInfo,
  downloadProgress,
  downloadedBytes,
  totalBytes,
  error,
  isPortable = false,
  onInstall,
  onCheckAgain,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
    } else if (isRendered) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered]);

  if (!isRendered) return null;

  const isDesktop = isTauri();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md ${
        isClosing ? 'animate-backdrop-out pointer-events-none' : 'animate-backdrop-in'
      }`}
      onClick={status === 'downloading' ? undefined : onClose}
    >
      <div
        className={`bg-slate-900/95 border border-white/20 rounded-2xl max-w-md w-full shadow-2xl p-5 sm:p-6 text-white select-none modal-wrapper ${
          isClosing ? 'animate-modal-out' : 'animate-modal-in'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Glowing Icon & Title */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-1 ring-white/20 flex-shrink-0">
              {status === 'checking' ? (
                <RefreshCw className="w-6 h-6 animate-spin text-white" />
              ) : status === 'up-to-date' ? (
                <Sparkles className="w-6 h-6 text-white" />
              ) : status === 'error' ? (
                <AlertTriangle className="w-6 h-6 text-amber-300" />
              ) : (
                <Rocket className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                {status === 'checking'
                  ? 'Проверка обновлений...'
                  : status === 'up-to-date'
                  ? 'У вас актуальная версия'
                  : status === 'error'
                  ? 'Ошибка обновления'
                  : status === 'downloading'
                  ? 'Загрузка обновления...'
                  : 'Доступно обновление'}
              </h3>
              {updateInfo && (
                <div className="flex items-center gap-1.5 mt-1 font-mono text-xs">
                  <span className="text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    v{updateInfo.currentVersion}
                  </span>
                  <span className="text-gray-500">→</span>
                  <span className="text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded border border-green-500/30">
                    v{updateInfo.version}
                  </span>
                  {isDesktop && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-sans">
                      {isPortable ? 'Portable' : 'Установлено'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {status !== 'downloading' && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl leading-none p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              &times;
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="space-y-3.5 mb-5 text-xs text-gray-300">
          {status === 'checking' && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 animate-fade-in">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin"></div>
              <p className="text-gray-400 text-xs">Проверяем наличие свежих версий...</p>
            </div>
          )}

          {status === 'available' && (
            <>
              <p className="leading-relaxed">
                {!isDesktop
                  ? 'На сервере доступна новая версия VoiceChat. Нажмите кнопку ниже, чтобы перезагрузить страницу и применить обновление.'
                  : isPortable
                  ? 'Вышла новая версия приложения. Текущий файл будет заменён на актуальный прямо на месте без установки в систему.'
                  : 'Вышла новая версия приложения. Обновление будет загружено и установлено автоматически в один клик.'}
              </p>

              {updateInfo?.notes && (
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl leading-relaxed max-h-36 overflow-y-auto custom-scrollbar">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Что нового:
                  </div>
                  <div className="whitespace-pre-line text-gray-200">
                    {updateInfo.notes}
                  </div>
                </div>
              )}
            </>
          )}

          {status === 'downloading' && (
            <div className="space-y-2 py-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                  Загрузка файлов...
                </span>
                <span className="text-blue-400 font-bold">{downloadProgress}%</span>
              </div>

              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 rounded-full shadow-md shadow-blue-500/50"
                  style={{ width: `${Math.max(4, downloadProgress)}%` }}
                />
              </div>

              {totalBytes > 0 && (
                <div className="text-[10px] text-gray-400 font-mono text-right">
                  {(downloadedBytes / (1024 * 1024)).toFixed(1)} из {(totalBytes / (1024 * 1024)).toFixed(1)} МБ
                </div>
              )}
            </div>
          )}

          {status === 'downloaded' && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-300 leading-relaxed">
              Обновление успешно загружено. Приложение будет перезапущено для завершения установки.
            </div>
          )}

          {status === 'up-to-date' && (
            <p className="leading-relaxed text-gray-300">
              Вы используете последнюю версию VoiceChat. Все улучшения и компоненты обновлены.
            </p>
          )}

          {status === 'error' && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 leading-relaxed">
              {error || 'Произошла ошибка при проверке или загрузке обновления.'}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
          {status === 'checking' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-all"
            >
              Отмена
            </button>
          )}

          {status === 'available' && (
            <div className="flex flex-wrap items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-all"
              >
                Позже
              </button>

              {isDesktop && isPortable && (
                <button
                  type="button"
                  onClick={() => onInstall('installer')}
                  title="Скачать и запустить установщик Windows (с ярлыками и записью в список программ)"
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/10 rounded-xl text-xs font-medium transition-all"
                >
                  Установить в систему
                </button>
              )}

              <button
                type="button"
                onClick={() => onInstall(isPortable ? 'portable' : 'installer')}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/40 active:scale-95 transition-all flex items-center gap-1.5"
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
              className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-green-600/40 active:scale-95 transition-all"
            >
              Перезапустить сейчас
            </button>
          )}

          {(status === 'up-to-date' || status === 'error') && (
            <>
              {status === 'error' && (
                <button
                  type="button"
                  onClick={onCheckAgain}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-medium transition-all"
                >
                  Повторить
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-blue-600/30"
              >
                Понятно
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
