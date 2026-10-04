import React, { memo } from 'react';
import { VolumeX, Volume1, Volume2, MicOff, Radio } from 'lucide-react';
import type { PeerInfo } from '../../types/protocol';
import { getInitials, getAvatarGradient } from './voiceUtils';

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
          ? 'border-green-500/50 bg-green-500/[0.06] shadow-sm shadow-green-500/20 ring-1 ring-green-500/30'
          : 'bg-black/30 hover:bg-black/40 border-white/10 hover:border-white/20'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-md transition-all ${
              isPeerSpeaking
                ? 'bg-gradient-to-br from-emerald-600 to-teal-800 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-emerald-500/40 animate-pulse scale-105 text-white'
                : peer.isDeafened
                ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                : peer.isMuted
                ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                : `bg-gradient-to-br ${gradient} border border-white/20 text-white shadow-md`
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWatchPeer(peer.peerId);
                }}
                className={`btn-compact !min-w-0 !min-h-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer shadow-sm ${
                  isWatched
                    ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40 hover:bg-blue-500/35'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/35 hover:scale-105 shadow-emerald-500/20'
                }`}
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                title={isWatched ? 'Свернуть трансляцию' : 'Смотреть стрим'}
              >
                <Radio
                  className={`w-3 h-3 shrink-0 ${
                    isWatched ? 'text-blue-400 animate-pulse' : 'text-emerald-400 animate-pulse'
                  }`}
                />
                <span>{isWatched ? 'Просмотр' : 'Смотреть стрим'}</span>
              </button>
            )}
            {peer.isDeafened ? (
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded border border-rose-500/30 font-medium">
                Заглушен (всё)
              </span>
            ) : peer.isMuted ? (
              <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded border border-red-500/30 font-medium">
                Заглушен
              </span>
            ) : isPeerSpeaking ? (
              <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.2 rounded border border-green-500/40 font-medium flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                Говорит
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">Участник</span>
            )}
          </div>
        </div>
      </div>

      {/* Peer Volume Slider */}
      <div
        className="mt-2.5 pt-2 border-t border-white/10 flex flex-col gap-1 select-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <button
            type="button"
            onClick={() => onToggleMutePeer(peer.peerId)}
            className="hover:text-white transition-colors flex items-center gap-1.5 text-[11px] p-0.5 -m-0.5 cursor-pointer"
            title={volume === 0 ? 'Включить звук' : 'Заглушить'}
          >
            {volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
            ) : volume < 50 ? (
              <Volume1 className="w-3.5 h-3.5 text-blue-300" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-blue-300" />
            )}
            <span>Громкость</span>
          </button>
          <span
            className={`font-mono font-semibold text-[11px] ${
              volume === 0
                ? 'text-red-400'
                : volume > 100
                ? 'text-emerald-400 font-bold'
                : 'text-blue-300'
            }`}
          >
            {volume}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="200"
          value={volume}
          onChange={(e) => onVolumeChange(peer.peerId, Number(e.target.value))}
          onInput={(e) => onVolumeChange(peer.peerId, Number((e.target as HTMLInputElement).value))}
          title={`Громкость: ${volume}%${volume > 100 ? ' (Усиление)' : ''}`}
          className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-all ${
            volume > 100
              ? 'bg-emerald-500/25 accent-emerald-400'
              : 'bg-white/15 accent-blue-500'
          }`}
        />
      </div>
    </div>
  );
});

VoicePeerCard.displayName = 'VoicePeerCard';
