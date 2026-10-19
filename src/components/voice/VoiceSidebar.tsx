import React, { memo, useCallback, type MutableRefObject } from "react";
import type { PeerInfo } from "../../types/protocol";
import { MAX_ROOM_PEERS } from "../../config";
import { VoiceCapacityBadge } from "./VoiceCapacityBadge";
import { ParticipantCard } from "./ParticipantCard";
import { VoiceEmptySlot } from "./VoiceEmptySlot";
import { VoiceControlBar } from "./VoiceControlBar";
import { VoiceHeader } from "./VoiceHeader";
import { PanelFooter } from "../ui";

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
        <VoiceHeader
          roomId={roomId}
          copied={copied}
          copyRoomId={copyRoomId}
          triggerShare={triggerShare}
          onOpenSettings={onOpenSettings}
        />

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
