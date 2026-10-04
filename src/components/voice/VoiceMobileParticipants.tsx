import React, { memo } from 'react';
import { Pencil, VolumeX, MicOff, Radio, Settings, Check, UserPlus } from 'lucide-react';
import type { PeerInfo } from '../../types/protocol';
import { Tooltip } from '../Tooltip';
import { getInitials, getAvatarGradient } from './voiceUtils';

export interface VoiceMobileParticipantsProps {
  myNickname: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSharing: boolean;
  peers: PeerInfo[];
  peerVolumes: Record<string, number>;
  streamingPeerIds: Set<string>;
  watchedPeerId: string | null;
  copied: boolean;
  copyRoomId: () => void;
  onOpenMobileNickEdit: () => void;
  onSelectPeer: (peer: PeerInfo) => void;
  onToggleWatchPeer: (peerId: string) => void;
}

export const VoiceMobileParticipants: React.FC<VoiceMobileParticipantsProps> = memo(({
  myNickname,
  isSpeaking,
  isMuted,
  isDeafened,
  isSharing,
  peers,
  peerVolumes,
  streamingPeerIds,
  watchedPeerId,
  copied,
  copyRoomId,
  onOpenMobileNickEdit,
  onSelectPeer,
  onToggleWatchPeer,
}) => {
  return (
    <div className="lg:hidden px-2 pt-2 sm:px-4 sm:pt-4 flex-shrink-0 z-10">
      <div className="bg-slate-950/45 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/40 px-3 py-2 sm:px-4 sm:py-2.5 overflow-hidden">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2.5 px-1">
          {/* 1. Self Participant Circle */}
          <Tooltip
            content={myNickname}
            description="Нажмите, чтобы изменить свой никнейм"
            position="bottom"
          >
            <div
              onClick={onOpenMobileNickEdit}
              className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group active:scale-95 transition-transform"
            >
              <div className="relative">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-all ${
                    isSpeaking && !isMuted
                      ? 'bg-gradient-to-br from-emerald-600 to-teal-800 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-emerald-500/40 animate-pulse scale-105 text-white'
                      : isDeafened
                      ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                      : isMuted
                      ? 'bg-white/10 border border-white/15 text-gray-400'
                      : 'bg-gradient-to-br from-blue-600 to-indigo-800 border border-blue-400/30 text-white'
                  }`}
                >
                  {getInitials(myNickname)}
                </div>

                {/* Hover Edit Pencil Overlay on Avatar */}
                <div className="absolute inset-0 rounded-full bg-slate-950/70 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-inner">
                  <Pencil className="w-4 h-4 text-white drop-shadow-md" />
                </div>

                {/* Status Badge in corner */}
                {isDeafened ? (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                    <VolumeX className="w-2.5 h-2.5" />
                  </span>
                ) : isMuted ? (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                    <MicOff className="w-2.5 h-2.5" />
                  </span>
                ) : isSharing ? (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm animate-pulse"
                    title="В эфире"
                  >
                    <Radio className="w-2.5 h-2.5" />
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-0.5 mt-0.5">
                <span
                  className={`text-[11px] font-semibold truncate max-w-[68px] text-center ${
                    isSpeaking && !isMuted ? 'text-emerald-400' : 'text-blue-300'
                  }`}
                >
                  {myNickname}
                </span>
                <div className="flex items-center gap-1">
                  <div className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-300 flex items-center justify-center">
                    Вы
                  </div>
                  {isSharing && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-400 animate-pulse"
                      title="Вы транслируете экран"
                    >
                      <Radio className="w-2.5 h-2.5 shrink-0" />
                      <span>Эфир</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Tooltip>

          {/* 2. Remote Peers Circles */}
          {peers.map((peer) => {
            const vol = peerVolumes[peer.peerId] ?? 100;
            const isPeerSpeaking = peer.isSpeaking && !peer.isMuted && !peer.isDeafened;
            const gradient = getAvatarGradient(peer.peerId || peer.nickname);

            return (
              <Tooltip
                key={peer.peerId}
                content={peer.nickname}
                description={`Громкость: ${vol}%. Нажмите для настройки звука`}
                position="bottom"
              >
                <div
                  onClick={() => onSelectPeer(peer)}
                  className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group active:scale-95 transition-transform animate-fade-in"
                >
                  <div className="relative">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-all ${
                        isPeerSpeaking
                          ? 'bg-gradient-to-br from-emerald-600 to-teal-800 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-emerald-500/40 animate-pulse scale-105 text-white'
                          : peer.isDeafened
                          ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                          : peer.isMuted
                          ? 'bg-white/10 border border-white/15 text-gray-400'
                          : `bg-gradient-to-br ${gradient} border border-white/20 text-white`
                      }`}
                    >
                      {getInitials(peer.nickname)}
                    </div>

                    {/* Hover Settings Gear Overlay on Avatar */}
                    <div className="absolute inset-0 rounded-full bg-slate-950/70 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-inner">
                      <Settings className="w-5 h-5 text-white drop-shadow-md" />
                    </div>

                    {/* Status Badge in corner */}
                    {peer.isDeafened ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                        <VolumeX className="w-2.5 h-2.5" />
                      </span>
                    ) : peer.isMuted ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm">
                        <MicOff className="w-2.5 h-2.5" />
                      </span>
                    ) : streamingPeerIds.has(peer.peerId) ? (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-slate-950 shadow-sm animate-pulse"
                        title="В эфире"
                      >
                        <Radio className="w-2.5 h-2.5" />
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-center gap-0.5 mt-0.5">
                    <span
                      className={`text-[11px] font-medium truncate max-w-[68px] text-center ${
                        isPeerSpeaking ? 'text-emerald-400 font-semibold' : 'text-gray-200'
                      }`}
                    >
                      {peer.nickname}
                    </span>
                    <div className="flex items-center gap-1">
                      <div
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold flex items-center justify-center border transition-all ${
                          vol === 0
                            ? 'bg-red-500/20 border-red-500/30 text-red-300'
                            : vol > 100
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 font-bold'
                            : 'bg-white/10 border-white/10 text-gray-300 group-hover:bg-white/15 group-hover:text-white'
                        }`}
                      >
                        {vol === 0 ? '0%' : `${vol}%`}
                      </div>
                      {streamingPeerIds.has(peer.peerId) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleWatchPeer(peer.peerId);
                          }}
                          className={`btn-compact !min-w-0 !min-h-0 h-[18px] px-1.5 py-0 rounded-full text-[9px] font-semibold inline-flex items-center gap-1 border transition-all cursor-pointer select-none shrink-0 ${
                            watchedPeerId === peer.peerId
                              ? 'bg-blue-500/30 border-blue-400 text-blue-200'
                              : 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300 active:scale-95'
                          }`}
                          style={{ minHeight: 'unset', minWidth: 'unset', height: '18px', maxHeight: '18px' }}
                          title={watchedPeerId === peer.peerId ? 'Свернуть трансляцию' : 'Смотреть стрим'}
                        >
                          <Radio className="w-2.5 h-2.5 shrink-0 animate-pulse text-emerald-400" />
                          <span className="leading-none">{watchedPeerId === peer.peerId ? 'Стрим' : 'Смотреть'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Tooltip>
            );
          })}

          {/* 3. Invite Button */}
          <Tooltip
            content="Пригласить друга"
            description={copied ? 'Ссылка уже в буфере обмена!' : 'Скопировать ссылку на комнату'}
            position="bottom"
          >
            <div
              onClick={copyRoomId}
              className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group active:scale-95 transition-transform"
            >
              <div
                className={`w-12 h-12 rounded-full border transition-all duration-300 ease-out flex items-center justify-center shadow-md ${
                  copied
                    ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-emerald-950/40'
                    : 'border-blue-500/30 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 group-hover:text-white shadow-blue-950/40'
                }`}
              >
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <Check
                    className={`w-5 h-5 text-emerald-400 absolute transition-all duration-300 ease-out ${
                      copied ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-[-45deg] pointer-events-none'
                    }`}
                  />
                  <UserPlus
                    className={`w-5 h-5 text-blue-400 group-hover:text-white absolute transition-all duration-300 ease-out ${
                      copied ? 'opacity-0 scale-50 rotate-45 pointer-events-none' : 'opacity-100 scale-100 rotate-0'
                    }`}
                  />
                </div>
              </div>
              <div className="flex flex-col items-center gap-0.5 mt-0.5">
                <div className="relative h-4 w-16 flex items-center justify-center overflow-hidden">
                  <span
                    className={`text-[11px] font-semibold text-emerald-400 whitespace-nowrap text-center transition-all duration-300 ease-out absolute inset-x-0 ${
                      copied ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90 pointer-events-none'
                    }`}
                  >
                    Готово
                  </span>
                  <span
                    className={`text-[11px] text-gray-300 group-hover:text-blue-300 font-medium whitespace-nowrap text-center transition-all duration-300 ease-out absolute inset-x-0 ${
                      copied ? 'opacity-0 -translate-y-2 scale-90 pointer-events-none' : 'opacity-100 translate-y-0 scale-100'
                    }`}
                  >
                    + Друг
                  </span>
                </div>
                <div
                  className={`px-2 py-0.5 rounded-full text-[9px] font-medium border transition-all duration-300 ease-out ${
                    copied
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-blue-500/15 border-blue-500/25 text-blue-300 group-hover:border-blue-400/40'
                  }`}
                >
                  <div className="relative h-3 w-14 flex items-center justify-center overflow-hidden">
                    <span
                      className={`transition-all duration-300 ease-out absolute inset-x-0 text-center whitespace-nowrap ${
                        copied ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                      }`}
                    >
                      Скопировано
                    </span>
                    <span
                      className={`transition-all duration-300 ease-out absolute inset-x-0 text-center whitespace-nowrap ${
                        copied ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
                      }`}
                    >
                      Инвайт
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});

VoiceMobileParticipants.displayName = 'VoiceMobileParticipants';
