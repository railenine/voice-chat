import React, { memo } from 'react';
import { VolumeX, MicOff, Radio, Pencil, Check, X, Settings } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { Badge, VolumeSlider } from '../ui';
import { getInitials, getAvatarGradient } from './voiceUtils';

export interface ParticipantCardProps {
  nickname: string;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSelf?: boolean;
  layout?: 'row' | 'compact';
  onClick?: () => void;
  // Self editing nickname (desktop row)
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
  layout = 'row',
  onClick,
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

  // Avatar markup shared across both layout modes
  const renderAvatar = (sizeClass: string) => (
    <div className="relative shrink-0">
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs transition-all duration-150 ${
          isActivelySpeaking
            ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)] text-[var(--bg)] bg-[var(--accent)]'
            : isDeafened
            ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
            : isMuted
            ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
            : isSelf
            ? 'bg-[var(--elevated)] border border-[var(--border)] text-[var(--fg)]'
            : `bg-linear-to-br ${gradient} border border-[var(--border)] text-[var(--fg)]`
        }`}
      >
        {getInitials(nickname)}
      </div>

      {/* Hover action overlay on compact mode */}
      {layout === 'compact' && (
        <div className="absolute inset-0 rounded-full bg-slate-950/70 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-inner">
          {isSelf ? (
            <Pencil className="w-4 h-4 text-[var(--fg)] drop-shadow-md" />
          ) : (
            <Settings className="w-4 h-4 text-[var(--fg)] drop-shadow-md" />
          )}
        </div>
      )}

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
      ) : isStreaming ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-[var(--surface)] shadow-xs animate-pulse"
          title="В эфире"
        >
          <Radio className="w-2.5 h-2.5" />
        </span>
      ) : null}
    </div>
  );

  // 1. COMPACT LAYOUT (Mobile Rail < 1024px)
  if (layout === 'compact') {
    return (
      <Tooltip
        content={nickname}
        description={
          isSelf
            ? 'Нажмите, чтобы изменить свой никнейм'
            : `Громкость: ${volume}%. Нажмите для настройки звука`
        }
        position="bottom"
      >
        <div
          onClick={onClick}
          className={`flex flex-col items-center gap-1 shrink-0 cursor-pointer group active:scale-95 transition-transform ${className}`}
        >
          {renderAvatar('w-12 h-12')}

          <div className="flex flex-col items-center gap-0.5 mt-0.5">
            <span
              className={`text-[11px] font-semibold truncate max-w-18 text-center transition-colors ${
                isActivelySpeaking
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--fg)]'
              }`}
            >
              {nickname}
            </span>

            <div className="flex items-center gap-1">
              {isSelf ? (
                <>
                  <Badge variant="tag" size="sm">
                    Вы
                  </Badge>
                  {isStreaming && (
                    <Badge variant="emerald" size="sm" pulse>
                      Эфир
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <Badge
                    variant="pill"
                    size="sm"
                    className={
                      volume === 0
                        ? 'text-rose-400 border-rose-500/30'
                        : volume > 100
                        ? 'text-emerald-400 border-emerald-500/30 font-bold'
                        : 'text-[var(--muted)]'
                    }
                  >
                    {volume === 0 ? '0%' : `${volume}%`}
                  </Badge>
                  {isStreaming && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (peerId && onToggleWatchPeer) onToggleWatchPeer(peerId);
                      }}
                      className={`btn-compact min-w-0! min-h-0! h-4.5 px-1.5 py-0 rounded-full text-[9px] font-semibold inline-flex items-center gap-1 border transition-all cursor-pointer select-none shrink-0 ${
                        isWatched
                          ? 'bg-blue-500/30 border-blue-400 text-blue-200'
                          : 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300 active:scale-95'
                      }`}
                      style={{ minHeight: 'unset', minWidth: 'unset', height: '18px', maxHeight: '18px' }}
                      title={isWatched ? 'Свернуть трансляцию' : 'Смотреть стрим'}
                    >
                      <Radio className="w-2.5 h-2.5 shrink-0 animate-pulse text-emerald-400" />
                      <span className="leading-none">{isWatched ? 'Стрим' : 'Смотреть'}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Tooltip>
    );
  }

  // 2. ROW LAYOUT (Desktop Sidebar >= 1024px)
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
        {renderAvatar('w-10 h-10')}

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
