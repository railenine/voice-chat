import React, { forwardRef, memo } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, WifiOff, PhoneCall } from 'lucide-react';
import { UpdateInfo, UpdateStatus } from '../../utils/updaterTypes';

interface UpdateModalBodyProps {
  status: UpdateStatus;
  fadeState: 'visible' | 'fading-out' | 'fading-in';
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  downloadedBytes: number;
  totalBytes: number;
  error: string | null;
  isDesktop: boolean;
  isPortable: boolean;
  isInRoom?: boolean;
}

export const UpdateModalBody = memo(
  forwardRef<HTMLDivElement, UpdateModalBodyProps>(({
    status,
    fadeState,
    updateInfo,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    error,
    isDesktop,
    isPortable,
    isInRoom = false,
  }, ref) => {
    return (
      <div
        ref={ref}
        className={`space-y-3.5 text-xs text-gray-300 transition-all duration-200 ease-out ${
          fadeState === 'fading-out'
            ? 'opacity-0 scale-[0.98] -translate-y-1 pointer-events-none'
            : 'opacity-100 scale-100 translate-y-0'
        }`}
      >
        {status === 'checking' && (
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

        {status === 'available' && (
          <div className="space-y-3 pt-1">
            {isInRoom && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-amber-300">
                <PhoneCall className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>Внимание:</strong> Вы находитесь в голосовом канале. Установка обновления разорвёт активное соединение и перезапустит приложение.
                </p>
              </div>
            )}

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed text-gray-200 text-xs">
                {!isDesktop
                  ? 'На сервере доступна новая версия RVxis. Нажмите кнопку ниже, чтобы обновить страницу.'
                  : isPortable
                  ? 'Вышла новая версия приложения. Текущий файл будет безопасно заменён на актуальный прямо на месте (включая проверку SHA-256).'
                  : 'Вышла новая версия приложения. Обновление будет проверено по цифровой подписи Ed25519 и установлено автоматически.'}
              </p>
            </div>

            {updateInfo?.notes && (
              <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl leading-relaxed max-h-36 overflow-y-auto custom-scrollbar">
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

        {status === 'downloading' && (
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

        {status === 'downloaded' && (
          <div className="p-3.5 bg-green-500/10 border border-green-500/30 rounded-xl text-green-300 leading-relaxed flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <span>Обновление успешно загружено и проверено. Готово к завершению установки.</span>
          </div>
        )}

        {status === 'installing' && (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3.5">
            <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
            <div>
              <p className="text-gray-200 text-xs font-medium">Применение обновления...</p>
              <p className="text-gray-500 text-[11px] mt-0.5">
                {isPortable ? 'Проверка хеша, атомарная замена исполняемого файла' : 'Запуск системного установщика'}
              </p>
            </div>
          </div>
        )}

        {status === 'restart-required' && (
          <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 leading-relaxed flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <span>Файл заменён. Запуск обновлённого приложения...</span>
          </div>
        )}

        {status === 'up-to-date' && (
          <div className="py-5 flex flex-col items-center justify-center text-center space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-400/20">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-gray-100 text-xs font-semibold">У вас установлена последняя версия</p>
              <p className="text-gray-400 text-[11px] mt-0.5 max-w-xs">
                Вы используете актуальную сборку RVxis. Все компоненты и аудиодвижок обновлены.
              </p>
            </div>
          </div>
        )}

        {status === 'offline' && (
          <div className="py-5 flex flex-col items-center justify-center text-center space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-slate-500/15 border border-slate-500/30 flex items-center justify-center shadow-lg shadow-slate-500/15 ring-1 ring-slate-400/20">
              <WifiOff className="w-6 h-6 text-slate-300" />
            </div>
            <div>
              <p className="text-gray-100 text-xs font-semibold">Отсутствует подключение к интернету</p>
              <p className="text-gray-400 text-[11px] mt-0.5 max-w-xs">
                Не удалось связаться с сервером обновлений. Проверьте соединение с сетью.
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 leading-relaxed flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{error || 'Произошла ошибка при проверке или загрузке обновления.'}</span>
          </div>
        )}
      </div>
    );
  })
);

UpdateModalBody.displayName = 'UpdateModalBody';
