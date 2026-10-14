import React, { memo, useCallback, type MutableRefObject } from 'react';
import {
  Settings,
  Share2,
  RefreshCw,
} from 'lucide-react';
import type { PeerInfo } from '../../types/protocol';
import { Tooltip } from '../Tooltip';
import { MAX_ROOM_PEERS } from '../../config';
import { VoiceCapacityBadge } from './VoiceCapacityBadge';
import { VoiceSelfCard } from './VoiceSelfCard';
import { VoicePeerCard } from './VoicePeerCard';
import { VoiceEmptySlot } from './VoiceEmptySlot';
import { VoiceControlBar } from './VoiceControlBar';

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
  error: string | null;
  connectionStatus: string;
  reconnectAttempts: number;
  showConnectedToast: boolean;
  isRetrying: boolean;
  handleRetry: () => void;
  copied: boolean;
  copyRoomId: () => void;
}

export const VoiceSidebar: React.FC<VoiceSidebarProps> = memo(({
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
  error,
  connectionStatus,
  reconnectAttempts,
  showConnectedToast,
  isRetrying,
  handleRetry,
  copied,
  copyRoomId,
}) => {
  const handleToggleMutePeer = useCallback((peerId: string) => {
    const current = peerVolumes[peerId] ?? 100;
    if (current > 0) {
      prevVolumesRef.current.set(peerId, current);
      setPeerVolume(peerId, 0);
    } else {
      const prev = prevVolumesRef.current.get(peerId) || 100;
      setPeerVolume(peerId, prev);
    }
  }, [peerVolumes, prevVolumesRef, setPeerVolume]);

  return (
    <aside className="hidden lg:flex flex-col w-80 xl:w-84 2xl:w-96 border-r border-white/10 bg-slate-950/45 backdrop-blur-xl shrink-0 select-none">
      {/* Sidebar Top: Logo & Room info */}
      <div className="p-3.5 px-4 border-b border-white/10 flex items-center justify-between bg-slate-950/60 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-linear-to-r from-blue-700 to-blue-900 flex items-center justify-center shadow-md shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-sm truncate">RVxis</h1>
            <p className="text-gray-400 text-xs font-mono truncate">#{roomId}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Tooltip content="Настройки" description="Звук, микрофон и горячие клавиши" position="bottom">
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Settings className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Поделиться ссылкой" description="Показать ссылку на комнату на 10 секунд" position="bottom">
            <button
              type="button"
              onClick={triggerShare}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Scrollable Participants Section */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        <VoiceCapacityBadge
          count={peers.length + 1}
          max={MAX_ROOM_PEERS}
          micCount={peers.filter((p) => !p.isMuted).length + (!isMuted ? 1 : 0)}
        />

        <div className="space-y-2.5">
          {/* Current User Card */}
          <VoiceSelfCard
            myNickname={myNickname}
            isEditingNick={isEditingNick}
            newNickInput={newNickInput}
            setNewNickInput={setNewNickInput}
            onStartEditingNick={onStartEditingNick}
            onCancelEditingNick={onCancelEditingNick}
            onSubmitNick={onSubmitNick}
            isSpeaking={isSpeaking}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isSharingScreen={isSharingScreen}
          />

          {/* Remote Peers Cards */}
          {peers.map((peer) => (
            <VoicePeerCard
              key={peer.peerId}
              peer={peer}
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

      {/* Desktop Sidebar Bottom Dock: Mic, Deafen, Noise Suppression, Status */}
      <div className="p-3 border-t border-white/10 bg-slate-950/60 backdrop-blur-xl space-y-2.5 shrink-0">
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

        {/* Status Wave & Connection Status (Desktop) */}
        <div className="flex items-center justify-between text-[11px] text-gray-400 px-0.5 min-h-5.5">
          {error ? (
            <div className="flex items-center justify-between w-full min-w-0 gap-1.5 animate-fade-in">
              <div className="flex items-center gap-1.5 min-w-0 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span className="truncate font-medium" title={error}>
                  {error}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-medium transition-all cursor-pointer shrink-0 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? '...' : 'Повторить'}</span>
              </button>
            </div>
          ) : !isConnected ? (
            <div className="flex items-center justify-between w-full min-w-0 gap-1.5 text-yellow-300 animate-fade-in">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                <span className="truncate font-medium">{connectionStatus}</span>
              </div>
              {reconnectAttempts > 0 && (
                <span className="text-[10px] text-yellow-400/80 font-mono shrink-0 px-1.5 py-0.2 rounded bg-yellow-500/10 border border-yellow-500/20">
                  попытка {reconnectAttempts}
                </span>
              )}
            </div>
          ) : showConnectedToast && !isSpeaking ? (
            <div className="flex items-center gap-1.5 text-emerald-400 animate-fade-in min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="font-medium text-emerald-300">Подключено ✓</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              {!isMuted && isConnected && (
                <div className="flex items-center gap-0.5 h-3 shrink-0">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-0.5 rounded-full transition-all duration-150 ${
                        isSpeaking ? 'bg-green-400 sound-wave-bar' : 'bg-blue-500/40'
                      }`}
                      style={{ height: isSpeaking ? undefined : '3px' }}
                    />
                  ))}
                </div>
              )}
              <span
                className={`truncate ${
                  isDeafened
                    ? 'text-red-400 font-medium'
                    : isMuted
                    ? 'text-red-400'
                    : isSpeaking
                    ? 'text-green-400'
                    : 'text-blue-400'
                }`}
              >
                {isDeafened
                  ? 'Заглушен (всё)'
                  : isMuted
                  ? 'Заглушен'
                  : isSpeaking
                  ? 'Говорит...'
                  : 'В эфире'}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
});

VoiceSidebar.displayName = 'VoiceSidebar';
