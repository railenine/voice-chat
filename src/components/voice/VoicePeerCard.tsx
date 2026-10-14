import React, { memo } from 'react';
import { VolumeX, MicOff, Radio } from 'lucide-react';
import type { PeerInfo } from '../../types/protocol';
import { getInitials, getAvatarGradient } from './voiceUtils';
import { Badge, VolumeSlider } from '../ui';

export interface VoicePeerCardProps {
  peer: PeerInfo;
  volume: number;
  onVolumeChange: (peerId: string, volume: number) => void;
  onToggleMutePeer: (peerId: string) => void;
  isStreaming: boolean;
  isWatched: boolean;
  onToggleWatchPeer: (peerId: string) => void;
}

export const VoicePeerCard: React.FC<VoicePeerCardProps> = memo(({
  peer,
  volume,
  onVolumeChange,
  onToggleMutePeer,
  isStreaming,
  isWatched,
  onToggleWatchPeer,
}) => {
  const isPeerSpeaking = peer.isSpeaking && !peer.isMuted && !peer.isDeafened;
  const gradient = getAvatarGradient(peer.peerId || peer.nickname);

  return (
    <div
      className={`p-3 rounded-xl border transition-all animate-fade-in ${
        isPeerSpeaking
          ? 'border-green-500/50 bg-green-500/6 shadow-sm shadow-green-500/20 ring-1 ring-green-500/30'
          : 'bg-black/30 hover:bg-black/40 border-white/10 hover:border-white/20'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-md transition-all ${
              isPeerSpeaking
                ? 'bg-linear-to-br from-emerald-600 to-teal-800 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-emerald-500/40 animate-pulse scale-105 text-white'
                : peer.isDeafened
                ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                : peer.isMuted
                ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                : `bg-linear-to-br ${gradient} border border-white/20 text-white shadow-md`
            }`}
          >
            {getInitials(peer.nickname)}
          </div>

          {/* Avatar Status Badge in corner */}
          {peer.isDeafened ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
              <VolumeX className="w-2.5 h-2.5" />
            </span>
          ) : peer.isMuted ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
              <MicOff className="w-2.5 h-2.5" />
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-white font-semibold text-xs sm:text-sm truncate block">
            {peer.nickname}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isStreaming && (
              <Badge
                variant={isWatched ? 'blue' : 'emerald'}
                size="sm"
                icon={
                  <Radio
                    className={`w-3 h-3 shrink-0 ${
                      isWatched ? 'text-blue-400' : 'text-emerald-400'
                    } animate-pulse`}
                  />
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWatchPeer(peer.peerId);
                }}
                title={isWatched ? 'Свернуть трансляцию' : 'Смотреть стрим'}
              >
                {isWatched ? 'Просмотр' : 'Смотреть стрим'}
              </Badge>
            )}
            {peer.isDeafened ? (
              <Badge variant="rose" size="sm">
                Заглушен (всё)
              </Badge>
            ) : peer.isMuted ? (
              <Badge variant="rose" size="sm">
                Заглушен
              </Badge>
            ) : isPeerSpeaking ? (
              <Badge variant="emerald" size="sm" pulse>
                Говорит
              </Badge>
            ) : (
              <span className="text-[11px] text-gray-400">Участник</span>
            )}
          </div>
        </div>
      </div>

      {/* Peer Volume Slider */}
      <div
        className="mt-2.5 pt-2 border-t border-white/10 select-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <VolumeSlider
          value={volume}
          onChange={(val) => onVolumeChange(peer.peerId, val)}
          onToggleMute={() => onToggleMutePeer(peer.peerId)}
        />
      </div>
    </div>
  );
});

VoicePeerCard.displayName = 'VoicePeerCard';
