import React, { memo } from 'react';
import { Share2, Check, Copy, X } from 'lucide-react';
import { Tooltip } from '../Tooltip';

export interface VoiceSharePanelProps {
  showShare: boolean;
  shareLink: string;
  shareKey: number;
  copied: boolean;
  copyRoomId: () => void;
  closeShare: () => void;
}

export const VoiceSharePanel: React.FC<VoiceSharePanelProps> = memo(({
  showShare,
  shareLink,
  shareKey,
  copied,
  copyRoomId,
  closeShare,
}) => {
  return (
    <div
      className={`grid-accordion flex-shrink-0 z-30 ${
        showShare ? 'grid-accordion-expanded' : 'grid-accordion-collapsed'
      }`}
    >
      <div className="overflow-hidden min-h-0">
        <div
          className={`bg-slate-950/80 backdrop-blur-xl border-b border-blue-500/25 px-3 py-2.5 sm:py-3 relative shadow-2xl accordion-inner ${
            showShare ? 'accordion-inner-expanded' : 'accordion-inner-collapsed'
          }`}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
            {/* Desktop Left Info: Share icon & title (hidden on < 640px) */}
            <div className="hidden sm:flex items-center gap-2.5 min-w-0 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm flex-shrink-0">
                <Share2 className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white truncate">Ссылка на комнату</span>
                <span className="text-[10px] text-blue-300/80 truncate">Исчезнет через 10 секунд</span>
              </div>
            </div>

            {/* Unified Link & Action Row: single streamlined row on mobile and desktop */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              {/* On mobile: compact share icon */}
              <div className="sm:hidden w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                <Share2 className="w-3.5 h-3.5" />
              </div>

              {/* Input with tap-to-copy */}
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  onClick={(e) => {
                    (e.target as HTMLInputElement).select();
                    copyRoomId();
                  }}
                  className="w-full py-1.5 sm:py-2 px-2.5 sm:px-3 bg-black/40 hover:bg-black/50 border border-white/10 focus:border-blue-400/50 rounded-xl text-white text-xs font-mono select-all focus:outline-none transition-colors truncate cursor-pointer"
                />
              </div>

              {/* Copy Button */}
              <Tooltip content={copied ? 'Скопировано!' : 'Скопировать ссылку'} description="Скопировать ссылку в буфер обмена" position="bottom">
                <button
                  type="button"
                  onClick={copyRoomId}
                  className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-medium transition-all text-xs flex items-center justify-center gap-1.5 flex-shrink-0 shadow-sm active:scale-95 whitespace-nowrap cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                      : 'bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white shadow-blue-900/40'
                  }`}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 flex-shrink-0 text-white animate-scale-up" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 flex-shrink-0 text-white" />
                  )}
                  <span className="share-btn-text">{copied ? 'Скопировано!' : 'Копировать'}</span>
                </button>
              </Tooltip>

              {/* Single Close Button */}
              <Tooltip content="Закрыть" description="Скрыть панель ссылки" position="bottom">
                <button
                  onClick={closeShare}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* 10-second animated progress line */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 overflow-hidden">
            <div
              key={shareKey}
              className={`h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400 ${
                showShare ? 'animate-countdown-10s' : 'opacity-0'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

VoiceSharePanel.displayName = 'VoiceSharePanel';
