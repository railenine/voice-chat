import React, { forwardRef, memo, useMemo } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, WifiOff, PhoneCall } from 'lucide-react';
import { UpdateInfo, UpdateStatus } from '../../utils/updaterTypes';
import { parseUpdateNotes } from '../../utils/updaterPolicy';

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
    const notesList = useMemo(
      () => parseUpdateNotes(updateInfo?.notes),
      [updateInfo?.notes]
    );

    return (
      <div
        ref={ref}
        className={`space-y-3.5 text-xs text-[var(--muted)] transition-all duration-200 ease-out ${
          fadeState === 'fading-out'
            ? 'opacity-0 scale-[0.98] -translate-y-1 pointer-events-none'
            : 'opacity-100 scale-100 translate-y-0'
        }`}
      >
        {status === 'checking' && (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3.5">
            <div className="relative flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
              </div>
            </div>
            <div>
              <p className="text-[var(--fg)] text-xs font-medium">Проверяем наличие свежих версий...</p>
              <p className="text-[var(--muted)] text-[11px] mt-0.5">Связываемся с сервером обновлений</p>
            </div>
          </div>
        )}

        {status === 'available' && (
          <div className="space-y-3 pt-1">
            {isInRoom && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-[var(--radius)] flex items-start gap-2.5 text-amber-300">
                <PhoneCall className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>Внимание:</strong> Вы находитесь в голосовом канале. Установка обновления разорвёт активное соединение и перезапустит приложение.
                </p>
              </div>
            )}

            <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[var(--fg)] text-xs">
                {!isDesktop
                  ? 'На сервере доступна новая версия RVxis. Нажмите кнопку ниже, чтобы обновить страницу.'
                  : isPortable
                  ? 'Вышла новая версия приложения. Текущий файл будет безопасно заменён на актуальный прямо на месте (включая проверку SHA-256).'
                  : 'Вышла новая версия приложения. Обновление будет проверено по цифровой подписи Ed25519 и установлено автоматически.'}
              </p>
            </div>

            {notesList.length > 0 && (
              <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] max-h-36 overflow-y-auto custom-scrollbar">
                <div className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                  Что нового:
                </div>
                <ul className="space-y-1.5 text-[var(--fg)] text-xs">
                  {notesList.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-[var(--accent)] text-xs leading-none mt-1 select-none shrink-0">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {status === 'downloading' && (
          <div className="space-y-2 py-3">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[var(--fg)] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></span>
                Загрузка файлов...
              </span>
              <span className="text-[var(--accent)] font-bold">{downloadProgress}%</span>
            </div>

            <div className="w-full h-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(4, downloadProgress)}%` }}
              />
            </div>

            {totalBytes > 0 && (
              <div className="text-[10px] text-[var(--muted)] font-mono text-right">
                {(downloadedBytes / (1024 * 1024)).toFixed(1)} из {(totalBytes / (1024 * 1024)).toFixed(1)} МБ
              </div>
            )}
          </div>
        )}

        {status === 'downloaded' && (
          <div className="p-3.5 bg-green-500/10 border border-green-500/30 rounded-[var(--radius)] text-green-300 leading-relaxed flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <span>Обновление успешно загружено и проверено. Готово к завершению установки.</span>
          </div>
        )}

        {status === 'installing' && (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3.5">
            <div className="w-10 h-10 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
            <div>
              <p className="text-[var(--fg)] text-xs font-medium">Применение обновления...</p>
              <p className="text-[var(--muted)] text-[11px] mt-0.5">
                {isPortable ? 'Проверка хеша, атомарная замена исполняемого файла' : 'Запуск системного установщика'}
              </p>
            </div>
          </div>
        )}

        {status === 'restart-required' && (
          <div className="p-3.5 bg-[var(--accent-soft)] border border-[var(--accent)]/30 rounded-[var(--radius)] text-[var(--accent)] leading-relaxed flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[var(--accent)] shrink-0" />
            <span>Файл заменён. Запуск обновлённого приложения...</span>
          </div>
        )}

        {status === 'up-to-date' && (
          <div className="py-5 flex flex-col items-center justify-center text-center space-y-2.5">
            <div className="w-11 h-11 rounded-[var(--radius-lg)] bg-[var(--accent-soft)] border border-[var(--accent)]/30 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <div>
              <p className="text-[var(--fg)] text-xs font-semibold">У вас установлена последняя версия</p>
              <p className="text-[var(--muted)] text-[11px] mt-0.5 max-w-xs">
                Вы используете актуальную сборку RVxis. Все компоненты и аудиодвижок обновлены.
              </p>
            </div>
          </div>
        )}

        {status === 'offline' && (
          <div className="py-5 flex flex-col items-center justify-center text-center space-y-2.5">
            <div className="w-11 h-11 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow-xs">
              <WifiOff className="w-6 h-6 text-[var(--muted)]" />
            </div>
            <div>
              <p className="text-[var(--fg)] text-xs font-semibold">Отсутствует подключение к интернету</p>
              <p className="text-[var(--muted)] text-[11px] mt-0.5 max-w-xs">
                Не удалось связаться с сервером обновлений. Проверьте соединение с сетью.
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-[var(--radius)] text-rose-300 leading-relaxed flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error || 'Произошла ошибка при проверке или загрузке обновления.'}</span>
          </div>
        )}
      </div>
    );
  })
);

UpdateModalBody.displayName = 'UpdateModalBody';
