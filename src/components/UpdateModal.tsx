import React, { useEffect, useState, useRef, memo } from 'react';
import { RefreshCw, Sparkles, AlertTriangle, Rocket, X, CheckCircle2 } from 'lucide-react';
import { UpdateInfo, UpdateStatus } from '../hooks/useAppUpdater';
import { isTauri, APP_VERSION } from '../config';
import { Tooltip } from './Tooltip';

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

export const UpdateModal: React.FC<UpdateModalProps> = memo(({
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
  const [renderedStatus, setRenderedStatus] = useState<UpdateStatus>(status);
  const [fadeState, setFadeState] = useState<'visible' | 'fading-out' | 'fading-in'>('visible');
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      setRenderedStatus(status);
      setFadeState('visible');
    } else if (isRendered) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered]);

  // Smooth cross-fade when status changes while modal is open
  useEffect(() => {
    if (!isOpen) return;

    if (status !== renderedStatus) {
      setFadeState('fading-out');
      const timer = setTimeout(() => {
        setRenderedStatus(status);
        setFadeState('fading-in');
        const inTimer = setTimeout(() => {
          setFadeState('visible');
        }, 220);
        return () => clearTimeout(inTimer);
      }, 140);
      return () => clearTimeout(timer);
    }
  }, [status, renderedStatus, isOpen]);

  // Track natural content height for smooth zero-jerk height transitions
  useEffect(() => {
    if (!contentRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h > 0) {
          setContentHeight(h);
        }
      }
    });
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [renderedStatus, isRendered]);

  if (!isRendered) return null;

  const isDesktop = isTauri();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md ${
        isClosing ? 'animate-backdrop-out pointer-events-none' : 'animate-backdrop-in'
      }`}
      onClick={renderedStatus === 'downloading' ? undefined : onClose}
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
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-white/20 flex-shrink-0 transition-all duration-500 ease-out ${
                renderedStatus === 'checking'
                  ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/30'
                  : renderedStatus === 'up-to-date'
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-500/30'
                  : renderedStatus === 'error'
                  ? 'bg-gradient-to-tr from-amber-600 to-rose-600 shadow-rose-500/30'
                  : 'bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-purple-500/30'
              }`}
            >
              <div
                className={`transition-all duration-200 ease-out flex items-center justify-center ${
                  fadeState === 'fading-out'
                    ? 'opacity-0 scale-75 rotate-[-15deg]'
                    : 'opacity-100 scale-100 rotate-0'
                }`}
              >
                {renderedStatus === 'checking' ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-white" />
                ) : renderedStatus === 'up-to-date' ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : renderedStatus === 'error' ? (
                  <AlertTriangle className="w-6 h-6 text-white" />
                ) : (
                  <Rocket className="w-6 h-6 text-white" />
                )}
              </div>
            </div>

            <div>
              <div
                className={`transition-all duration-200 ease-out ${
                  fadeState === 'fading-out'
                    ? 'opacity-0 -translate-y-1'
                    : 'opacity-100 translate-y-0'
                }`}
              >
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {renderedStatus === 'checking'
                    ? 'Проверка обновлений'
                    : renderedStatus === 'up-to-date'
                    ? 'У вас актуальная версия'
                    : renderedStatus === 'error'
                    ? 'Ошибка обновления'
                    : renderedStatus === 'downloading'
                    ? 'Загрузка обновления...'
                    : renderedStatus === 'downloaded'
                    ? 'Обновление готово'
                    : 'Доступно обновление'}
                </h3>

                {/* Subtitle with version badge */}
                <div className="flex items-center gap-1.5 mt-1 font-mono text-xs">
                  {renderedStatus === 'checking' && (
                    <span className="text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                      Установлена: v{APP_VERSION}
                    </span>
                  )}

                  {renderedStatus === 'up-to-date' && (
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      v{APP_VERSION} — актуально
                    </span>
                  )}

                  {renderedStatus === 'error' && (
                    <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      Сбой проверки
                    </span>
                  )}

                  {(renderedStatus === 'available' || renderedStatus === 'downloading' || renderedStatus === 'downloaded') && (
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

          {renderedStatus !== 'downloading' && (
            <Tooltip content="Закрыть" position="bottom">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center -mr-1 -mt-1"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Dynamic Content Body with Smooth Height Transition */}
        <div
          className="overflow-hidden transition-[height] duration-300 ease-out mb-5"
          style={{ height: contentHeight !== undefined ? `${contentHeight}px` : 'auto' }}
        >
          <div
            ref={contentRef}
            className={`space-y-3.5 text-xs text-gray-300 transition-all duration-200 ease-out ${
              fadeState === 'fading-out'
                ? 'opacity-0 scale-[0.98] -translate-y-1 pointer-events-none'
                : 'opacity-100 scale-100 translate-y-0'
            }`}
          >
            {renderedStatus === 'checking' && (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-3.5">
                <div className="relative flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-400 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                </div>
                <div>
                  <p className="text-gray-200 text-xs font-medium">Проверяем наличие свежих версий...</p>
                  <p className="text-gray-500 text-[11px] mt-0.5">Связываемся с сервером обновлений</p>
                </div>
              </div>
            )}

            {renderedStatus === 'available' && (
              <div className="space-y-3 pt-1">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-gray-200 text-xs">
                    {!isDesktop
                      ? 'На сервере доступна новая версия VoiceChat. Нажмите кнопку ниже, чтобы перезагрузить страницу и применить обновление.'
                      : isPortable
                      ? 'Вышла новая версия приложения. Текущий файл будет заменён на актуальный прямо на месте без повторной установки.'
                      : 'Вышла новая версия приложения. Обновление будет загружено и установлено автоматически в один клик.'}
                  </p>
                </div>

                {updateInfo?.notes && (
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl leading-relaxed max-h-36 overflow-y-auto custom-scrollbar">
                    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Что нового:
                    </div>
                    <div className="whitespace-pre-line text-gray-200 text-xs">
                      {updateInfo.notes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {renderedStatus === 'downloading' && (
              <div className="space-y-2 py-3">
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

            {renderedStatus === 'downloaded' && (
              <div className="p-3.5 bg-green-500/10 border border-green-500/30 rounded-xl text-green-300 leading-relaxed flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span>Обновление успешно загружено. Приложение готово к перезапуску для завершения установки.</span>
              </div>
            )}

            {renderedStatus === 'up-to-date' && (
              <div className="py-5 flex flex-col items-center justify-center text-center space-y-2.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-400/20">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-gray-100 text-xs font-semibold">У вас установлена последняя версия</p>
                  <p className="text-gray-400 text-[11px] mt-0.5 max-w-xs">
                    Вы используете актуальную сборку VoiceChat. Все компоненты и аудиодвижок обновлены.
                  </p>
                </div>
              </div>
            )}

            {renderedStatus === 'error' && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 leading-relaxed flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                <span>{error || 'Произошла ошибка при проверке или загрузке обновления.'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons with Crossfade */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
          <div
            className={`flex items-center justify-end gap-2.5 w-full transition-all duration-200 ease-out ${
              fadeState === 'fading-out' ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            {renderedStatus === 'checking' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-all"
              >
                Отмена
              </button>
            )}

            {renderedStatus === 'available' && (
              <div className="flex flex-wrap items-center justify-end gap-2 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-all"
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
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/10 rounded-xl text-xs font-medium transition-all"
                    >
                      Установить в систему
                    </button>
                  </Tooltip>
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

            {renderedStatus === 'downloading' && (
              <button
                disabled
                className="w-full py-2 bg-white/10 text-gray-400 rounded-xl text-xs font-medium cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                <span>{isPortable ? 'Загрузка и замена файла...' : 'Установка обновления...'}</span>
              </button>
            )}

            {renderedStatus === 'downloaded' && (
              <button
                type="button"
                onClick={() => onInstall()}
                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-green-600/40 active:scale-95 transition-all"
              >
                Перезапустить сейчас
              </button>
            )}

            {(renderedStatus === 'up-to-date' || renderedStatus === 'error') && (
              <>
                {renderedStatus === 'error' && (
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
    </div>
  );
});

UpdateModal.displayName = 'UpdateModal';
