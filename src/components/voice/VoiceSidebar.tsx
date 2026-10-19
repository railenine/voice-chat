import React, { memo, useCallback, type MutableRefObject } from "react";
import { Settings, Share2, Check } from "lucide-react";
import type { PeerInfo } from "../../types/protocol";
import { Tooltip } from "../Tooltip";
import { MAX_ROOM_PEERS } from "../../config";
import { VoiceCapacityBadge } from "./VoiceCapacityBadge";
import { ParticipantCard } from "./ParticipantCard";
import { VoiceEmptySlot } from "./VoiceEmptySlot";
import { VoiceControlBar } from "./VoiceControlBar";
import { Button, PanelHeader, PanelFooter } from "../ui";

export interface VoiceSidebarProps {
  roomId: string;
  myNickname: string;
  isEditingNick: boolean;
  newNickInput: string;
  setNewNickInput: (val: string) => void;
  onStartEditingNick: () => void;
  onCancelEditingNick: () => void;
  onSubmitNick: (e: React.FormEvent) => void;
  peers: PeerInfo[];
  peerVolumes: Record<string, number>;
  setPeerVolume: (peerId: string, vol: number) => void;
  prevVolumesRef: MutableRefObject<Map<string, number>>;
  streamingPeerIds: Set<string>;
  watchedPeerId: string | null;
  onToggleWatchPeer: (peerId: string) => void;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isNoiseSuppression: boolean;
  canShareScreen: boolean;
  isSharingScreen: boolean;
  isConnectingScreen: boolean;
  muteHotkeyLabel: string;
  deafenHotkeyLabel: string;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleNoiseSuppression: () => void;
  onScreenShareClick: () => void;
  handleLeave: () => void;
  triggerShare: () => void;
  onOpenSettings: () => void;
  isConnected: boolean;
  copied: boolean;
  copyRoomId: () => void;
}

export const VoiceSidebar: React.FC<VoiceSidebarProps> = memo(
  ({
    roomId,
    myNickname,
    isEditingNick,
    newNickInput,
    setNewNickInput,
    onStartEditingNick,
    onCancelEditingNick,
    onSubmitNick,
    peers,
    peerVolumes,
    setPeerVolume,
    prevVolumesRef,
    streamingPeerIds,
    watchedPeerId,
    onToggleWatchPeer,
    isSpeaking,
    isMuted,
    isDeafened,
    isNoiseSuppression,
    canShareScreen,
    isSharingScreen,
    isConnectingScreen,
    muteHotkeyLabel,
    deafenHotkeyLabel,
    toggleMute,
    toggleDeafen,
    toggleNoiseSuppression,
    onScreenShareClick,
    handleLeave,
    triggerShare,
    onOpenSettings,
    isConnected,
    copied,
    copyRoomId,
  }) => {
    const handleToggleMutePeer = useCallback(
      (peerId: string) => {
        const current = peerVolumes[peerId] ?? 100;
        if (current > 0) {
          prevVolumesRef.current.set(peerId, current);
          setPeerVolume(peerId, 0);
        } else {
          const prev = prevVolumesRef.current.get(peerId) || 100;
          setPeerVolume(peerId, prev);
        }
      },
      [peerVolumes, prevVolumesRef, setPeerVolume],
    );

    return (
      <aside className="hidden lg:flex flex-col w-80 xl:w-84 2xl:w-96 border-r border-white/10 bg-slate-950/45 backdrop-blur-xl shrink-0 select-none">
        {/* Sidebar Top: Logo & Room info */}
        <PanelHeader>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-linear-to-r from-blue-700 to-blue-900 flex items-center justify-center shadow-md shrink-0">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-xl truncate">RVxis</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Tooltip
              content="Настройки"
              description="Звук, микрофон и горячие клавиши"
              position="bottom"
            >
              <Button
                variant="glass"
                size="icon-sm"
                onClick={onOpenSettings}
                aria-label="Настройки"
              >
                <Settings className="w-4 h-4 text-gray-300" />
              </Button>
            </Tooltip>
            <Tooltip
              content={copied ? "Скопировано!" : "Поделиться"}
              description={
                copied
                  ? "Ссылка в буфере обмена"
                  : "Скопировать ссылку на комнату"
              }
              position="bottom"
            >
              <Button
                variant={copied ? "emerald" : "glass"}
                size="icon-sm"
                onClick={triggerShare}
                aria-label={
                  copied ? "Ссылка скопирована" : "Поделиться ссылкой"
                }
                className={`transition-all duration-300 ${
                  copied ? "shadow-xs shadow-emerald-500/20" : ""
                }`}
              >
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <Share2
                    className={`w-4 h-4 transition-all duration-300 ${
                      copied
                        ? "opacity-0 scale-50 rotate-45 pointer-events-none"
                        : "opacity-100 scale-100 rotate-0 text-gray-300"
                    }`}
                  />
                  <Check
                    className={`w-4 h-4 absolute inset-0 transition-all duration-300 text-emerald-400 ${
                      copied
                        ? "opacity-100 scale-100 rotate-0"
                        : "opacity-0 scale-50 -rotate-45 pointer-events-none"
                    }`}
                  />
                </div>
              </Button>
            </Tooltip>
          </div>
        </PanelHeader>

        {/* Scrollable Participants Section */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          <VoiceCapacityBadge
            count={peers.length + 1}
            max={MAX_ROOM_PEERS}
            micCount={
              peers.filter((p) => !p.isMuted).length + (!isMuted ? 1 : 0)
            }
          />

          <div className="space-y-2.5">
            {/* Current User Card */}
            <ParticipantCard
              isSelf
              nickname={myNickname}
              isEditingNick={isEditingNick}
              newNickInput={newNickInput}
              setNewNickInput={setNewNickInput}
              onStartEditingNick={onStartEditingNick}
              onCancelEditingNick={onCancelEditingNick}
              onSubmitNick={onSubmitNick}
              isSpeaking={isSpeaking}
              isMuted={isMuted}
              isDeafened={isDeafened}
              isStreaming={isSharingScreen}
            />

            {/* Remote Peers Cards */}
            {peers.map((peer) => (
              <ParticipantCard
                key={peer.peerId}
                peerId={peer.peerId}
                nickname={peer.nickname}
                isSpeaking={peer.isSpeaking}
                isMuted={peer.isMuted}
                isDeafened={peer.isDeafened}
                volume={peerVolumes[peer.peerId] ?? 100}
                onVolumeChange={setPeerVolume}
                onToggleMutePeer={handleToggleMutePeer}
                isStreaming={streamingPeerIds.has(peer.peerId)}
                isWatched={watchedPeerId === peer.peerId}
                onToggleWatchPeer={onToggleWatchPeer}
              />
            ))}

            {/* Empty slot */}
            {peers.length === 0 && isConnected && (
              <VoiceEmptySlot copied={copied} copyRoomId={copyRoomId} />
            )}
          </div>
        </div>

        {/* Desktop Sidebar Bottom Dock: Mic, Deafen, Noise Suppression, Screen Share, Leave */}
        <PanelFooter className="px-3">
          <VoiceControlBar
            isMuted={isMuted}
            isDeafened={isDeafened}
            isNoiseSuppression={isNoiseSuppression}
            canShareScreen={canShareScreen}
            isSharingScreen={isSharingScreen}
            isConnectingScreen={isConnectingScreen}
            muteHotkeyLabel={muteHotkeyLabel}
            deafenHotkeyLabel={deafenHotkeyLabel}
            toggleMute={toggleMute}
            toggleDeafen={toggleDeafen}
            toggleNoiseSuppression={toggleNoiseSuppression}
            onScreenShareClick={onScreenShareClick}
            handleLeave={handleLeave}
            className="flex items-center justify-start gap-2"
          />
        </PanelFooter>
      </aside>
    );
  },
);

VoiceSidebar.displayName = "VoiceSidebar";
