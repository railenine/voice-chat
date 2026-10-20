import React, { memo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '../ui';

export interface ConnectionStatusIndicatorProps {
  isConnected: boolean;
  error?: string | null;
  connectionStatus?: string;
  reconnectAttempts?: number;
  handleRetry?: () => void;
  isRetrying?: boolean;
  isMobile?: boolean;
  className?: string;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = memo(({
  isConnected,
  error,
  connectionStatus,
  reconnectAttempts = 0,
  handleRetry,
  isRetrying = false,
  isMobile = false,
  className = '',
}) => {
  const basePill =
    'inline-flex items-center h-6 rounded-full border text-xs font-medium leading-none shrink-0 select-none transition-colors animate-fade-in';

  if (error) {
    const isRoomFull =
      error.toLowerCase().includes('заполнена') ||
      error.toLowerCase().includes('room_full');
    const displayError = isRoomFull ? 'Комната переполнена' : error;
    const shortError = isRoomFull ? 'Заполнено' : 'Ошибка';

    return (
      <div
        role="status"
        aria-live="polite"
        className={`${basePill} pl-2.5 pr-1.5 gap-1.5 bg-(--danger-soft) border-(--danger-border) text-(--danger) ${className}`}
        title={error}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-(--danger) shrink-0 -translate-y-px" aria-hidden="true" />
        <span className={`leading-none truncate ${isMobile ? 'max-w-28' : 'max-w-44 xl:max-w-64'}`}>
          {isMobile ? shortError : displayError}
        </span>

        {handleRetry && (
          <>
            <span className="w-px h-3 bg-(--danger-border) shrink-0 self-center" aria-hidden="true" />
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              title="Повторить подключение"
              aria-label="Повторить подключение"
              className="inline-flex items-center justify-center w-4 h-4 rounded text-(--danger) hover:text-white transition-colors cursor-pointer disabled:opacity-50 active:scale-90 focus-visible:outline-2 focus-visible:outline-(--accent) shrink-0"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    );
  }

  if (!isConnected) {
    const attemptText = reconnectAttempts > 0 ? ` #${reconnectAttempts}` : '';
    const label = isMobile
      ? reconnectAttempts > 0
        ? `Повтор${attemptText}`
        : 'Подключение...'
      : `Подключение...${reconnectAttempts > 0 ? ` (#${reconnectAttempts})` : ''}`;

    return (
      <div
        role="status"
        aria-live="polite"
        className={`${basePill} pl-2.5 pr-3 gap-1.5 bg-(--warning-soft) border-(--warning-border) text-(--warning) ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-(--warning) animate-pulse shrink-0 -translate-y-px" aria-hidden="true" />
        <span className="truncate leading-none">{label}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${basePill} pl-2.5 pr-3 gap-1.5 bg-(--success-soft) border-(--success-border) text-(--success) ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-(--success) shrink-0 -translate-y-px" aria-hidden="true" />
      <span className={`leading-none ${isMobile ? 'hidden xs:inline' : 'inline'}`}>Подключено</span>
      <span className={`leading-none ${isMobile ? 'xs:hidden' : 'hidden'}`}>В сети</span>
    </div>
  );
});

ConnectionStatusIndicator.displayName = 'ConnectionStatusIndicator';
