import React, { memo } from 'react';
import { VolumeX, MicOff, Radio, Pencil, Check, X } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { Badge, VolumeSlider } from '../ui';
import { getInitials, getAvatarGradient } from './voiceUtils';

export interface ParticipantCardProps {
  nickname: string;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSelf?: boolean;
  // Self editing nickname
  isEditingNick?: boolean;
  newNickInput?: string;
  setNewNickInput?: (val: string) => void;
  onStartEditingNick?: () => void;
  onCancelEditingNick?: () => void;
  onSubmitNick?: (e: React.FormEvent) => void;
  // Remote peer audio & stream
  peerId?: string;
  volume?: number;
  onVolumeChange?: (peerId: string, volume: number) => void;
  onToggleMutePeer?: (peerId: string) => void;
  isStreaming?: boolean;
  isWatched?: boolean;
  onToggleWatchPeer?: (peerId: string) => void;
  className?: string;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = memo(({
  nickname,
  isSpeaking,
  isMuted,
  isDeafened,
  isSelf = false,
  isEditingNick = false,
  newNickInput = '',
  setNewNickInput,
  onStartEditingNick,
  onCancelEditingNick,
  onSubmitNick,
  peerId,
  volume = 100,
  onVolumeChange,
  onToggleMutePeer,
  isStreaming = false,
  isWatched = false,
  onToggleWatchPeer,
  className = '',
}) => {
  const isActivelySpeaking = isSpeaking && !isMuted && !isDeafened;
  const gradient = getAvatarGradient(peerId || nickname);

  return (
    <div
      className={`p-3 rounded-[var(--radius)] border transition-all duration-150 select-none ${
        isActivelySpeaking
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]/20 shadow-xs ring-1 ring-[var(--accent)]/40'
          : isSelf
          ? 'bg-[var(--surface)] hover:bg-[color-mix(in_oklch,var(--surface)_90%,var(--fg))] border-[var(--border)] border-l-2 border-l-[var(--accent)]/70'
          : 'bg-[var(--surface)]/60 hover:bg-[var(--surface)] border-[var(--border)]'
      } ${className}`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar with speaking ring (2px accent ring per design spec) */}
        <div className="relative shrink-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-sm transition-all duration-150 ${
              isActivelySpeaking
                ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)] text-[var(--bg)] bg-[var(--accent)] scale-105'
                : isDeafened
                ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                : isMuted
                ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                : isSelf
                ? 'bg-linear-to-br from-blue-700 to-indigo-900 border border-[var(--accent)]/40 text-white'
                : `bg-linear-to-br ${gradient} border border-white/15 text-white`
            }`}
          >
            {getInitials(nickname)}
          </div>

          {/* Micro status icon badge in corner */}
          {isDeafened ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-[var(--surface)] shadow-xs"
              title="Звук заглушен"
            >
              <VolumeX className="w-2.5 h-2.5" />
            </span>
          ) : isMuted ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-[var(--surface)] shadow-xs"
              title="Микрофон выключен"
            >
              <MicOff className="w-2.5 h-2.5" />
            </span>
          ) : null}
        </div>

        {/* Info & Statuses */}
        <div className="flex-1 min-w-0">
          {isSelf && isEditingNick ? (
            <form onSubmit={onSubmitNick} className="flex items-center gap-1 w-full">
              <input
                type="text"
                value={newNickInput}
                onChange={(e) => setNewNickInput?.(e.target.value)}
                maxLength={24}
                autoFocus
                className="flex-1 min-w-0 px-2 py-0.5 text-xs bg-[var(--bg)] border border-[var(--accent)] rounded-[var(--radius)] text-[var(--fg)] focus:outline-none"
              />
              <Tooltip content="Сохранить" position="top">
                <button
                  type="submit"
                  className="text-emerald-400 hover:text-emerald-300 p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
              <Tooltip content="Отмена" position="top">
                <button
                  type="button"
                  onClick={onCancelEditingNick}
                  className="text-rose-400 hover:text-rose-300 p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </form>
          ) : isSelf ? (
            <Tooltip content="Изменить никнейм" description="Нажмите, чтобы изменить свой никнейм" position="top">
              <div
                onClick={onStartEditingNick}
                className="group cursor-pointer flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors"
              >
                <span className="text-[var(--fg)] font-semibold text-xs sm:text-sm truncate max-w-32">
                  {nickname}
                </span>
                <Pencil className="w-3.5 h-3.5 text-[var(--muted)] opacity-60 group-hover:opacity-100 group-hover:text-[var(--accent)] shrink-0 transition-all" />
              </div>
            </Tooltip>
          ) : (
            <span className="text-[var(--fg)] font-semibold text-xs sm:text-sm truncate block">
              {nickname}
            </span>
          )}

          {/* Subtitle / Status Tags */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {isStreaming && (
              <Badge
                variant={isWatched ? 'blue' : 'emerald'}
                size="sm"
                icon={
                  <Radio
                    className={`w-3 h-3 shrink-0 ${
                      isWatched ? 'text-[var(--accent)]' : 'text-emerald-400'
                    } animate-pulse`}
                  />
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (peerId && onToggleWatchPeer) onToggleWatchPeer(peerId);
                }}
                title={isWatched ? 'Свернуть трансляцию' : 'Смотреть стрим'}
              >
                {isWatched ? 'Просмотр' : 'Смотреть стрим'}
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
            ) : isActivelySpeaking ? (
              <Badge variant="pill" size="sm" pulse>
                Говорит
              </Badge>
            ) : isSelf ? (
              <Badge variant="tag" size="sm">
                Вы
              </Badge>
            ) : (
              <span className="text-[11px] text-[var(--muted)] font-normal">Участник</span>
            )}
          </div>
        </div>
      </div>

      {/* Peer Volume Slider (only for remote peers) */}
      {!isSelf && peerId && onVolumeChange && onToggleMutePeer && (
        <div
          className="mt-2.5 pt-2 border-t border-[var(--border)] select-none"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <VolumeSlider
            value={volume}
            onChange={(val) => onVolumeChange(peerId, val)}
            onToggleMute={() => onToggleMutePeer(peerId)}
          />
        </div>
      )}
    </div>
  );
});

ParticipantCard.displayName = 'ParticipantCard';
