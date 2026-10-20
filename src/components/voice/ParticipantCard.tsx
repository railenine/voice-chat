import React, { memo } from 'react';
import { VolumeX, MicOff, Radio, Pencil, Check, X, Settings } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { Badge, VolumeSlider } from '../ui';
import { getInitials } from './voiceUtils';

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

  // Avatar markup shared across both layout modes
  const renderAvatar = (sizeClass: string) => (
    <div className="relative shrink-0">
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs transition-all duration-150 ${
          isActivelySpeaking
            ? 'ring-2 ring-(--accent) ring-offset-2 ring-offset-(--surface) text-(--bg) bg-(--accent)'
            : isDeafened
            ? 'bg-(--danger-soft) border border-(--danger-border) text-(--danger)'
            : isMuted
            ? 'bg-(--danger-soft) border border-(--danger-border) text-(--danger)'
            : 'bg-(--elevated) border border-(--border) text-(--fg)'
        }`}
      >
        {getInitials(nickname)}
      </div>

      {/* Hover action overlay on compact mode */}
      {layout === 'compact' && (
        <div className="absolute inset-0 rounded-full bg-(--bg)/80 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-inner">
          {isSelf ? (
            <Pencil className="w-4 h-4 text-(--fg) drop-shadow-md" />
          ) : (
            <Settings className="w-4 h-4 text-(--fg) drop-shadow-md" />
          )}
        </div>
      )}

      {/* Micro status icon badge in corner */}
      {isDeafened ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-(--danger) text-(--bg) flex items-center justify-center border-2 border-(--surface) shadow-xs"
          aria-label="Звук заглушен"
        >
          <VolumeX className="w-2.5 h-2.5" />
        </span>
      ) : isMuted ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-(--danger) text-(--bg) flex items-center justify-center border-2 border-(--surface) shadow-xs"
          aria-label="Микрофон выключен"
        >
          <MicOff className="w-2.5 h-2.5" />
        </span>
      ) : isStreaming ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-(--accent) text-(--bg) flex items-center justify-center border-2 border-(--surface) shadow-xs animate-pulse"
          aria-label="В эфире"
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
                  ? 'text-(--accent)'
                  : 'text-(--fg)'
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
                    <Badge variant="blue" size="sm" pulse>
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
                        ? 'text-(--danger) border-(--danger-border)'
                        : volume > 100
                        ? 'text-(--accent) border-(--accent)/30 font-bold'
                        : 'text-(--muted)'
                    }
                  >
                    {volume === 0 ? '0%' : `${volume}%`}
                  </Badge>
                  {isStreaming && (
                    <Tooltip content={isWatched ? 'Свернуть трансляцию' : 'Смотреть стрим'} position="top">
                      <Badge
                        variant={isWatched ? 'accent' : 'blue'}
                        size="sm"
                        pulse={!isWatched}
                        icon={<Radio className="w-2.5 h-2.5 shrink-0" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (peerId && onToggleWatchPeer) onToggleWatchPeer(peerId);
                        }}
                      >
                        {isWatched ? 'Стрим' : 'Смотреть'}
                      </Badge>
                    </Tooltip>
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
      className={`p-3 rounded-(--radius) border transition-all duration-150 select-none ${
        isActivelySpeaking
          ? 'border-(--accent) bg-(--accent-soft)/20 shadow-xs ring-1 ring-(--accent)/40'
          : isSelf
          ? 'bg-(--surface) hover:bg-[color-mix(in_oklch,var(--surface)_90%,var(--fg))] border-(--border) border-l-2 border-l-(--accent)/70'
          : 'bg-(--surface)/60 hover:bg-(--surface) border-(--border)'
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
                className="flex-1 min-w-0 px-2 py-0.5 text-xs bg-(--bg) border border-(--accent) rounded-(--radius) text-(--fg) focus:outline-none"
              />
              <Tooltip content="Сохранить" position="top">
                <button
                  type="submit"
                  aria-label="Сохранить никнейм"
                  className="text-(--accent) hover:text-(--fg) p-1 rounded-(--radius) hover:bg-(--fg-soft) transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-(--accent)"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
              <Tooltip content="Отмена" position="top">
                <button
                  type="button"
                  onClick={onCancelEditingNick}
                  aria-label="Отменить изменение никнейма"
                  className="text-(--danger) hover:text-(--danger)/80 p-1 rounded-(--radius) hover:bg-(--fg-soft) transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-(--accent)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </form>
          ) : isSelf ? (
            <Tooltip content="Изменить никнейм" description="Нажмите, чтобы изменить свой никнейм" position="top">
              <div
                onClick={onStartEditingNick}
                className="group cursor-pointer flex items-center gap-1.5 hover:text-(--accent) transition-colors"
              >
                <span className="text-(--fg) font-semibold text-xs sm:text-sm truncate max-w-32">
                  {nickname}
                </span>
                <Pencil className="w-3.5 h-3.5 text-(--muted) opacity-60 group-hover:opacity-100 group-hover:text-(--accent) shrink-0 transition-all" />
              </div>
            </Tooltip>
          ) : (
            <span className="text-(--fg) font-semibold text-xs sm:text-sm truncate block">
              {nickname}
            </span>
          )}

          {/* Subtitle / Status Tags */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {isStreaming && (
              <Tooltip content={isWatched ? 'Свернуть трансляцию' : 'Смотреть стрим'} position="top">
                <Badge
                  variant={isWatched ? 'accent' : 'blue'}
                  size="sm"
                  pulse={!isWatched}
                  icon={<Radio className="w-3 h-3 shrink-0" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (peerId && onToggleWatchPeer) onToggleWatchPeer(peerId);
                  }}
                >
                  {isWatched ? 'Просмотр' : 'Смотреть стрим'}
                </Badge>
              </Tooltip>
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
              <span className="text-[11px] text-(--muted) font-normal">Участник</span>
            )}
          </div>
        </div>
      </div>

      {/* Peer Volume Slider (only for remote peers) */}
      {!isSelf && peerId && onVolumeChange && onToggleMutePeer && (
        <div
          className="mt-2.5 pt-2 border-t border-(--border) select-none"
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
