import React, { memo } from 'react';
import { Settings, Share2, Check, Copy } from 'lucide-react';
import { PanelHeader, Button, Logo, Badge } from '../ui';
import { Tooltip } from '../Tooltip';
import { MAX_ROOM_PEERS } from '../../config';

export interface VoiceHeaderProps {
  roomId: string;
  copied: boolean;
  copyRoomId: () => void;
  triggerShare: () => void;
  onOpenSettings: () => void;
  isMobile?: boolean;
  isSmartphone?: boolean;
  participantCount?: number;
  maxParticipants?: number;
  className?: string;
}

export const VoiceHeader: React.FC<VoiceHeaderProps> = memo(({
  roomId,
  copied,
  copyRoomId,
  triggerShare,
  onOpenSettings,
  isMobile = false,
  isSmartphone = false,
  participantCount,
  maxParticipants = MAX_ROOM_PEERS,
  className = '',
}) => {
  return (
    <PanelHeader
      style={
        isMobile
          ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }
          : undefined
      }
      className={`${
        isMobile
          ? 'lg:hidden z-20 px-3.5 pb-2.5 pt-2'
          : 'px-3'
      } ${className}`}
    >
      {/* Left: Branding & Room Info */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Logo size="sm" className="shadow-xs" />

        <div className="min-w-0 flex items-center gap-2 shrink-0">
          <span className="text-sm sm:text-base font-bold text-[var(--fg)] tracking-tight shrink-0">
            RVxis
          </span>

          {/* Room ID Badge & Copy Action */}
          <Tooltip
            content={copied ? 'Скопировано!' : 'Скопировать ссылку'}
            description="Скопировать ссылку на комнату в буфер"
            position="bottom"
          >
            <button
              type="button"
              onClick={copyRoomId}
              className="text-xs text-[var(--muted)] hover:text-[var(--accent)] font-mono transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer py-1 px-1.5 rounded-[var(--radius)] hover:bg-[var(--fg-soft)] active:scale-95"
            >
              <span className="font-semibold">#{roomId}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-scale-up" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[var(--muted)] hover:text-[var(--fg)] shrink-0 transition-colors" />
              )}
            </button>
          </Tooltip>

          {/* Participant count badge on mobile */}
          {typeof participantCount === 'number' && (
            <Badge
              variant="pill"
              className={`shrink-0 transition-colors ${
                participantCount >= maxParticipants
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-semibold'
                  : participantCount >= 8
                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                  : 'text-[var(--muted)]'
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
            </Badge>
          )}
        </div>
      </div>

      {/* Right: Quick Actions (Settings & Share) */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Tooltip
          content={isSmartphone ? 'Настройки звука' : 'Настройки'}
          description={isSmartphone ? 'Выбор микрофона и динамиков' : 'Звук, микрофон и горячие клавиши'}
          position="bottom"
        >
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={onOpenSettings}
            aria-label="Настройки"
          >
            <Settings className="w-4 h-4 text-[var(--muted)] hover:text-[var(--fg)]" />
          </Button>
        </Tooltip>

        <Tooltip
          content={copied ? 'Скопировано!' : 'Поделиться'}
          description={copied ? 'Ссылка в буфере обмена' : 'Скопировать ссылку на комнату'}
          position="bottom"
        >
          <Button
            variant={copied ? 'emerald' : 'secondary'}
            size="icon-sm"
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
                    : 'opacity-100 scale-100 rotate-0 text-[var(--muted)]'
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
    </PanelHeader>
  );
});

VoiceHeader.displayName = 'VoiceHeader';
