import React, { memo } from 'react';
import { Volume2, Check, Copy, Settings, Share2 } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { Button } from '../ui';

import { MAX_ROOM_PEERS } from '../../config';

export interface VoiceMobileHeaderProps {
  roomId: string;
  copied: boolean;
  copyRoomId: () => void;
  triggerShare: () => void;
  showShare?: boolean;
  onOpenSettings: () => void;
  isSmartphone: boolean;
  participantCount?: number;
  maxParticipants?: number;
}

export const VoiceMobileHeader: React.FC<VoiceMobileHeaderProps> = memo(({
  roomId,
  copied,
  copyRoomId,
  triggerShare,
  showShare,
  onOpenSettings,
  isSmartphone,
  participantCount,
  maxParticipants = MAX_ROOM_PEERS,
}) => {
  return (
    <header
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
      className="lg:hidden px-3.5 pb-2.5 pt-2 border-b border-white/10 backdrop-blur-xl bg-slate-950/60 flex items-center justify-between gap-2.5 shrink-0 z-20"
    >
      {/* Left: Branding & Room Info */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white shadow-md shrink-0">
          <Volume2 className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold text-white tracking-tight shrink-0">RVxis</span>
          <Tooltip
            content={copied ? 'Скопировано!' : 'Скопировать ссылку'}
            description="Скопировать ссылку на комнату в буфер"
            position="bottom"
          >
            <button
              type="button"
              onClick={copyRoomId}
              className="text-xs text-gray-400 hover:text-blue-300 font-mono transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-white/5 active:scale-95"
            >
              <span className="font-semibold">#{roomId}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-scale-up" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-white shrink-0 transition-colors" />
              )}
            </button>
          </Tooltip>

          {typeof participantCount === 'number' && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 transition-colors ${
                participantCount >= maxParticipants
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold'
                  : participantCount >= 8
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                  : 'bg-white/6 border border-white/10 text-gray-400'
              }`}
              title={
                participantCount >= maxParticipants
                  ? 'Комната заполнена'
                  : participantCount >= 8
                  ? 'Mesh P2P (8+ участников)'
                  : 'Количество участников'
              }
            >
              {participantCount}/{maxParticipants}
            </span>
          )}
        </div>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Tooltip
          content={isSmartphone ? 'Настройки звука' : 'Настройки'}
          description={isSmartphone ? 'Выбор микрофона и динамиков' : 'Звук, микрофон и горячие клавиши'}
          position="bottom"
        >
          <Button
            variant="glass"
            size="icon"
            onClick={onOpenSettings}
            aria-label="Настройки"
          >
            <Settings className="w-4 h-4 text-gray-300" />
          </Button>
        </Tooltip>
        <Tooltip
          content={copied ? 'Скопировано!' : 'Поделиться'}
          description={copied ? 'Ссылка в буфере обмена' : 'Скопировать ссылку на комнату'}
          position="bottom"
        >
          <Button
            variant={copied ? 'emerald' : 'glass'}
            size="icon"
            onClick={triggerShare}
            aria-label={copied ? 'Ссылка скопирована' : 'Поделиться ссылкой'}
            className={`transition-all duration-300 ${
              copied ? 'shadow-xs shadow-emerald-500/20' : ''
            }`}
          >
            <div className="relative w-4 h-4 flex items-center justify-center">
              <Share2
                className={`w-4 h-4 transition-all duration-300 ${
                  copied
                    ? 'opacity-0 scale-50 rotate-45 pointer-events-none'
                    : 'opacity-100 scale-100 rotate-0 text-gray-300'
                }`}
              />
              <Check
                className={`w-4 h-4 absolute inset-0 transition-all duration-300 text-emerald-400 ${
                  copied
                    ? 'opacity-100 scale-100 rotate-0'
                    : 'opacity-0 scale-50 -rotate-45 pointer-events-none'
                }`}
              />
            </div>
          </Button>
        </Tooltip>
      </div>
    </header>
  );
});

VoiceMobileHeader.displayName = 'VoiceMobileHeader';
