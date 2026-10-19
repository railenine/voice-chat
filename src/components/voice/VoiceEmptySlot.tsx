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
        role="button"
        tabIndex={0}
        className="bg-[var(--surface)] hover:bg-[var(--elevated)] border border-[var(--border)] hover:border-[var(--accent)]/50 active:scale-[0.99] cursor-pointer transition-colors rounded-[var(--radius)] p-3 flex items-center gap-3 select-none group animate-fade-in"
      >
        <div className="w-10 h-10 rounded-full bg-[var(--elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] group-hover:text-[var(--accent)] group-hover:border-[var(--accent)]/40 transition-colors shrink-0">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <Check
              className={`w-5 h-5 text-emerald-400 absolute transition-all duration-300 ease-out ${
                copied
                  ? 'opacity-100 scale-100 rotate-0'
                  : 'opacity-0 scale-50 -rotate-45 pointer-events-none'
              }`}
            />
            <UserPlus
              className={`w-5 h-5 text-[var(--muted)] group-hover:text-[var(--accent)] absolute transition-all duration-300 ease-out ${
                copied
                  ? 'opacity-0 scale-50 rotate-45 pointer-events-none'
                  : 'opacity-100 scale-100 rotate-0'
              }`}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <span
            className={`text-xs sm:text-sm font-semibold block transition-colors ${
              copied ? 'text-emerald-400' : 'text-[var(--fg)]'
            }`}
          >
            {copied ? 'Ссылка скопирована!' : 'В комнате пока никого нет'}
          </span>
          <span className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
            {copied ? (
              <span className="text-emerald-400 font-medium">Отправьте её друзьям</span>
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
