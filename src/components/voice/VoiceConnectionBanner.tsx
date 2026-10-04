import React, { memo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { resolveConnectionBannerState } from '../../utils/connectionPolicy';

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
        isMobile ? 'lg:hidden' : 'border-b border-white/10 bg-white/[0.02]'
      } flex-shrink-0 select-none`}
    >
      <div className={`banner-expand-inner ${isMobile ? 'px-2 pt-2 sm:px-4 sm:pt-3' : 'p-3'}`}>
        {currentBannerState.error ? (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-xs shadow-lg shadow-rose-950/40 backdrop-blur-xl transition-all">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-rose-300 text-xs mb-0.5">
                  {isRoomFull ? 'Комната переполнена' : 'Ошибка подключения'}
                </div>
                <p className="text-[11px] text-rose-200/90 leading-relaxed break-words">
                  {isRoomFull
                    ? 'В комнате достигнут лимит (максимум 12 участников для прямого соединения Full-Mesh P2P).'
                    : currentBannerState.error}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 mt-2 border-t border-rose-500/20">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 border border-rose-500/40 text-rose-200 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Подключение...' : isRoomFull ? 'Проверить снова' : 'Повторить попытку'}</span>
              </button>
            </div>
          </div>
        ) : currentBannerState.showConnectedToast && currentBannerState.isConnected ? (
          <div className="flex items-center gap-2.5 p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-300 text-xs shadow-lg shadow-emerald-950/20 backdrop-blur-xl transition-all">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <span className="font-medium">Подключено ✓</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2.5 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-300 text-xs shadow-lg shadow-yellow-950/20 backdrop-blur-xl transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
              </div>
              <span className="truncate font-medium">{currentBannerState.connectionStatus}</span>
            </div>
            {currentBannerState.reconnectAttempts > 0 && (
              <span className="text-[10px] text-yellow-400/80 font-mono flex-shrink-0 px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20">
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
