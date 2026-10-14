import React, { memo } from 'react';
import { VolumeX, MicOff, Radio, Pencil, Check, X } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { Badge } from '../ui';
import { getInitials } from './voiceUtils';

export interface VoiceSelfCardProps {
  myNickname: string;
  isEditingNick: boolean;
  newNickInput: string;
  setNewNickInput: (val: string) => void;
  onStartEditingNick: () => void;
  onCancelEditingNick: () => void;
  onSubmitNick: (e: React.FormEvent) => void;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
}

export const VoiceSelfCard: React.FC<VoiceSelfCardProps> = memo(({
  myNickname,
  isEditingNick,
  newNickInput,
  setNewNickInput,
  onStartEditingNick,
  onCancelEditingNick,
  onSubmitNick,
  isSpeaking,
  isMuted,
  isDeafened,
  isSharingScreen,
}) => {
  const isSelfSpeaking = isSpeaking && !isMuted && !isDeafened;

  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        isSelfSpeaking
          ? 'border-green-500/50 bg-green-500/6 shadow-sm shadow-green-500/20 ring-1 ring-green-500/30'
          : 'bg-black/30 hover:bg-black/40 border-blue-500/30 hover:border-blue-500/45'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-md transition-all ${
              isSelfSpeaking
                ? 'bg-linear-to-br from-emerald-600 to-teal-800 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-emerald-500/40 animate-pulse scale-105 text-white'
                : isDeafened
                ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                : isMuted
                ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                : 'bg-linear-to-br from-blue-600 to-indigo-800 border border-blue-400/30 text-white shadow-md'
            }`}
          >
            {getInitials(myNickname)}
          </div>

          {/* Avatar Status Badge in corner */}
          {isDeafened ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
              <VolumeX className="w-2.5 h-2.5" />
            </span>
          ) : isMuted ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
              <MicOff className="w-2.5 h-2.5" />
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-0">
          {isEditingNick ? (
            <form onSubmit={onSubmitNick} className="flex items-center gap-1 w-full">
              <input
                type="text"
                value={newNickInput}
                onChange={(e) => setNewNickInput(e.target.value)}
                maxLength={24}
                autoFocus
                className="flex-1 min-w-0 px-2 py-0.5 text-xs bg-black/40 border border-blue-400/60 rounded text-white focus:outline-none"
              />
              <Tooltip content="Сохранить" position="top">
                <button
                  type="submit"
                  className="text-green-400 hover:text-green-300 p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
              <Tooltip content="Отмена" position="top">
                <button
                  type="button"
                  onClick={onCancelEditingNick}
                  className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </form>
          ) : (
            <Tooltip content="Изменить никнейм" description="Нажмите, чтобы изменить свой никнейм" position="top">
              <div
                onClick={onStartEditingNick}
                className="group cursor-pointer flex items-center gap-1.5 hover:text-blue-300 transition-colors"
              >
                <span className="text-white font-semibold text-xs sm:text-sm truncate max-w-30">
                  {myNickname}
                </span>
                <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-60 group-hover:opacity-100 group-hover:text-blue-300 shrink-0 transition-all" />
              </div>
            </Tooltip>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            {isSharingScreen && (
              <Badge
                variant="emerald"
                size="sm"
                pulse
                icon={<Radio className="w-3 h-3 text-emerald-400 shrink-0" />}
              >
                В эфире
              </Badge>
            )}
            {isDeafened ? (
              <Badge variant="rose" size="sm">
                Заглушен (всё)
              </Badge>
            ) : isMuted ? (
              <Badge variant="rose" size="sm">
                Заглушен
              </Badge>
            ) : isSelfSpeaking ? (
              <Badge variant="emerald" size="sm" pulse>
                Говорит
              </Badge>
            ) : (
              <Badge variant="blue" size="sm">
                Вы
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

VoiceSelfCard.displayName = 'VoiceSelfCard';
