import React, { memo } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { resolveConnectionBannerState } from '../../utils/connectionPolicy';
import { Button } from '../ui';

export interface BannerState {
  error: string | null;
  showConnectedToast: boolean;
  connectionStatus: string;
  reconnectAttempts: number;
  isConnected: boolean;
}

export interface VoiceConnectionBannerProps {
  isMobile?: boolean;
  showBanner: boolean;
  currentBannerState: BannerState;
  handleRetry: () => void;
  isRetrying: boolean;
}

export const VoiceConnectionBanner: React.FC<VoiceConnectionBannerProps> = memo(({
  isMobile = false,
  showBanner,
  currentBannerState,
  handleRetry,
  isRetrying,
}) => {
  const { isRoomFull } = resolveConnectionBannerState(currentBannerState);

  return (
    <div
      className={`banner-expand-wrapper ${showBanner ? 'expanded' : ''} ${
        isMobile ? 'lg:hidden' : 'border-b border-(--border) bg-(--surface)'
      } shrink-0 select-none`}
    >
      <div className={`banner-expand-inner ${isMobile ? 'px-3 pt-2 sm:px-4 sm:pt-2.5 pb-1' : 'px-3 py-2'}`}>
        {currentBannerState.error ? (
          <div className="p-3 bg-(--danger-soft) border border-(--danger-border) rounded-(--radius) text-(--danger) text-xs shadow-lg shadow-black/20 backdrop-blur-xl transition-all">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-(--radius) bg-(--danger-soft) border border-(--danger-border) flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-3.5 h-3.5 text-(--danger)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-(--danger) text-xs mb-0.5">
                  {isRoomFull ? 'Комната переполнена' : 'Ошибка подключения'}
                </div>
                <p className="text-[11px] text-(--fg)/90 leading-relaxed wrap-break-word">
                  {isRoomFull
                    ? 'В комнате достигнут лимит (максимум 12 участников для прямого соединения Full-Mesh P2P).'
                    : currentBannerState.error}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 mt-2 border-t border-(--danger-border)">
              <Button
                variant="danger"
                size="sm"
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />}
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? 'Подключение...' : isRoomFull ? 'Проверить снова' : 'Повторить попытку'}
              </Button>
            </div>
          </div>
        ) : currentBannerState.showConnectedToast && currentBannerState.isConnected ? (
          <div className="flex items-center gap-2.5 p-2.5 bg-(--success-soft) border border-(--success-border) rounded-(--radius) text-(--success) text-xs shadow-lg shadow-black/20 backdrop-blur-xl transition-all animate-fade-in">
            <div className="w-5 h-5 rounded-full bg-(--success-soft) border border-(--success-border) flex items-center justify-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-(--success)"></span>
            </div>
            <span className="font-medium">Подключено к комнате ✓</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2.5 p-2.5 bg-(--warning-soft) border border-(--warning-border) rounded-(--radius) text-(--warning) text-xs shadow-lg shadow-black/20 backdrop-blur-xl transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-(--warning-soft) border border-(--warning-border) flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-(--warning) animate-pulse"></span>
              </div>
              <span className="truncate font-medium">{currentBannerState.connectionStatus}</span>
            </div>
            {currentBannerState.reconnectAttempts > 0 && (
              <span className="text-[10px] text-(--warning) font-mono shrink-0 px-2 py-0.5 rounded-full bg-(--warning-soft) border border-(--warning-border)">
                попытка {currentBannerState.reconnectAttempts}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

VoiceConnectionBanner.displayName = 'VoiceConnectionBanner';
