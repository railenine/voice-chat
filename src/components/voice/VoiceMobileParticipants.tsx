import React, { memo } from 'react';
import { Check, UserPlus } from 'lucide-react';
import type { PeerInfo } from '../../types/protocol';
import { Tooltip } from '../Tooltip';
import { Card } from '../ui';
import { ParticipantCard } from './ParticipantCard';

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
    <div className="lg:hidden px-2 pt-2 sm:px-4 sm:pt-4 shrink-0 z-10 select-none">
      <Card variant="surface" className="px-3 py-2 sm:px-4 sm:py-2.5 overflow-hidden">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2 px-1">
          {/* 1. Self Participant Compact Tile */}
          <ParticipantCard
            layout="compact"
            isSelf
            nickname={myNickname}
            isSpeaking={isSpeaking}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isStreaming={isSharing}
            onClick={onOpenMobileNickEdit}
          />

          {/* 2. Remote Peers Compact Tiles */}
          {peers.map((peer) => (
            <ParticipantCard
              key={peer.peerId}
              layout="compact"
              peerId={peer.peerId}
              nickname={peer.nickname}
              isSpeaking={peer.isSpeaking}
              isMuted={peer.isMuted}
              isDeafened={peer.isDeafened}
              volume={peerVolumes[peer.peerId] ?? 100}
              isStreaming={streamingPeerIds.has(peer.peerId)}
              isWatched={watchedPeerId === peer.peerId}
              onToggleWatchPeer={onToggleWatchPeer}
              onClick={() => onSelectPeer(peer)}
            />
          ))}

          {/* 3. Invite Button */}
          <Tooltip
            content="Пригласить друга"
            description={copied ? 'Ссылка уже в буфере обмена!' : 'Скопировать ссылку на комнату'}
            position="bottom"
          >
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
              aria-label={copied ? "Ссылка скопирована в буфер обмена" : "Пригласить друга"}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-(--accent) rounded-(--radius)"
            >
              <div
                className={`w-12 h-12 rounded-full border transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-center ${
                  copied
                    ? 'border-(--accent) bg-(--accent-soft) text-(--accent) shadow-xs'
                    : 'border-(--accent)/30 bg-(--accent-soft) hover:bg-[color-mix(in_oklch,var(--accent)_20%,transparent)] text-(--accent)'
                }`}
              >
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <Check
                    className={`w-5 h-5 text-(--accent) absolute transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      copied ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-45 pointer-events-none'
                    }`}
                  />
                  <UserPlus
                    className={`w-5 h-5 text-(--accent) absolute transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      copied ? 'opacity-0 scale-50 rotate-45 pointer-events-none' : 'opacity-100 scale-100 rotate-0'
                    }`}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center gap-0.5 mt-0.5" aria-live="polite">
                <div className="relative h-4 w-16 flex items-center justify-center overflow-hidden">
                  <span
                    className={`text-[11px] font-semibold text-(--accent) whitespace-nowrap text-center transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] absolute inset-x-0 ${
                      copied ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90 pointer-events-none'
                    }`}
                  >
                    Готово
                  </span>
                  <span
                    className={`text-[11px] text-(--muted) group-hover:text-(--accent) font-medium whitespace-nowrap text-center transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] absolute inset-x-0 ${
                      copied ? 'opacity-0 -translate-y-2 scale-90 pointer-events-none' : 'opacity-100 translate-y-0 scale-100'
                    }`}
                  >
                    + Друг
                  </span>
                </div>
                <div
                  className={`px-2 py-0.5 rounded-full text-[9px] font-medium border transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    copied
                      ? 'bg-(--accent-soft) border-(--accent)/40 text-(--accent)'
                      : 'bg-(--surface) border-(--border) text-(--muted) group-hover:border-(--accent)/40'
                  }`}
                >
                  <div className="relative h-3 w-14 flex items-center justify-center overflow-hidden">
                    <span
                      className={`transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] absolute inset-x-0 text-center whitespace-nowrap ${
                        copied ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                      }`}
                    >
                      Скопировано
                    </span>
                    <span
                      className={`transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] absolute inset-x-0 text-center whitespace-nowrap ${
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
      </Card>
    </div>
  );
});

VoiceMobileParticipants.displayName = 'VoiceMobileParticipants';
