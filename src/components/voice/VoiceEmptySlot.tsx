import React, { memo } from 'react';
import { UserPlus, Check } from 'lucide-react';
import { Tooltip } from '../Tooltip';

export interface VoiceEmptySlotProps {
  copied: boolean;
  copyRoomId: () => void;
}

export const VoiceEmptySlot: React.FC<VoiceEmptySlotProps> = memo(({
  copied,
  copyRoomId,
}) => {
  return (
    <Tooltip content="Скопировать ссылку" description="Нажмите, чтобы скопировать приглашение в буфер" position="top">
      <div
        onClick={copyRoomId}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            copyRoomId();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={copied ? "Ссылка скопирована в буфер обмена" : "Скопировать ссылку на комнату"}
        className={`border rounded-(--radius) p-3 flex items-center gap-3 select-none group animate-fade-in cursor-pointer active:scale-[0.99] transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-2 focus-visible:outline-(--accent) focus-visible:outline-offset-2 ${
          copied
            ? 'bg-[color-mix(in_oklch,var(--surface)_92%,var(--accent)_8%)] border-(--accent)/40 shadow-xs'
            : 'bg-(--surface) hover:bg-(--elevated) border-(--border) hover:border-(--accent)/50'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 ${
            copied
              ? 'bg-(--accent-soft) border-(--accent)/40 text-(--accent) shadow-xs'
              : 'bg-(--elevated) border-(--border) text-(--muted) group-hover:text-(--accent) group-hover:border-(--accent)/40'
          }`}
        >
          <div className="relative w-5 h-5 flex items-center justify-center">
            <Check
              className={`w-5 h-5 text-(--accent) absolute transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                copied
                  ? 'opacity-100 scale-100 rotate-0'
                  : 'opacity-0 scale-50 -rotate-45 pointer-events-none'
              }`}
            />
            <UserPlus
              className={`w-5 h-5 text-(--muted) group-hover:text-(--accent) absolute transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                copied
                  ? 'opacity-0 scale-50 rotate-45 pointer-events-none'
                  : 'opacity-100 scale-100 rotate-0'
              }`}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0" aria-live="polite">
          <span
            className={`text-xs sm:text-sm font-semibold block transition-colors duration-150 ${
              copied ? 'text-(--fg)' : 'text-(--fg)'
            }`}
          >
            {copied ? 'Ссылка скопирована!' : 'В комнате пока никого нет'}
          </span>
          <span className="text-[11px] text-(--muted) flex items-center gap-1.5 mt-0.5">
            {copied ? (
              <span className="text-(--accent) font-medium">Отправьте её друзьям</span>
            ) : (
              <span>Нажмите, чтобы пригласить</span>
            )}
          </span>
        </div>
      </div>
    </Tooltip>
  );
});

VoiceEmptySlot.displayName = 'VoiceEmptySlot';
