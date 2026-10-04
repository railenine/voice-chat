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
        className="bg-black/30 hover:bg-black/40 border border-white/10 hover:border-white/20 active:scale-[0.98] cursor-pointer transition-all rounded-xl p-3 flex items-center gap-3 select-none group animate-fade-in"
      >
        <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-blue-400 group-hover:border-blue-400/30 transition-all flex-shrink-0">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <Check
              className={`w-5 h-5 text-emerald-400 absolute transition-all duration-300 ease-out ${
                copied
                  ? 'opacity-100 scale-100 rotate-0'
                  : 'opacity-0 scale-50 rotate-[-45deg] pointer-events-none'
              }`}
            />
            <UserPlus
              className={`w-5 h-5 text-gray-400 group-hover:text-blue-400 absolute transition-all duration-300 ease-out ${
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
              copied ? 'text-emerald-400' : 'text-gray-300 group-hover:text-white'
            }`}
          >
            {copied ? 'Ссылка скопирована!' : 'В комнате пока никого нет'}
          </span>
          <span className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
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
