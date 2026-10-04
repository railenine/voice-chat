import React, { memo } from 'react';
import { Volume2, VolumeX, X, Radio } from 'lucide-react';
import type { PeerInfo } from '../../types/protocol';
import { Modal } from '../Modal';
import { Tooltip } from '../Tooltip';
import { getInitials, getAvatarGradient } from './voiceUtils';

export interface MobilePeerVolumeModalProps {
  selectedMobilePeer: PeerInfo | null;
  cachedMobilePeer: PeerInfo | null;
  onClose: () => void;
  peerVolume: number;
  setPeerVolume: (peerId: string, vol: number) => void;
  isStreaming: boolean;
  watchedPeerId: string | null;
  onToggleWatchPeer: (peerId: string) => void;
  streamVolume: number;
  onStreamVolumeChange: (peerId: string, vol: number) => void;
}

export const MobilePeerVolumeModal: React.FC<MobilePeerVolumeModalProps> = memo(({
  selectedMobilePeer,
  cachedMobilePeer,
  onClose,
  peerVolume,
  setPeerVolume,
  isStreaming,
  watchedPeerId,
  onToggleWatchPeer,
  streamVolume,
  onStreamVolumeChange,
}) => {
  return (
    <Modal isOpen={Boolean(selectedMobilePeer)} onClose={onClose}>
      {cachedMobilePeer && (
        <>
          <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-sm sm:text-base">Громкость: {cachedMobilePeer.nickname}</h3>
            </div>
            <Tooltip content="Закрыть" position="bottom">
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>

          <div className="modal-content-scroll p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base bg-gradient-to-br ${getAvatarGradient(
                  cachedMobilePeer.peerId || cachedMobilePeer.nickname
                )} text-white`}
              >
                {getInitials(cachedMobilePeer.nickname)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-sm truncate">{cachedMobilePeer.nickname}</p>
                <p className="text-xs text-gray-400">
                  {cachedMobilePeer.isDeafened
                    ? 'Заглушил весь звук'
                    : cachedMobilePeer.isMuted
                    ? 'Микрофон отключен'
                    : cachedMobilePeer.isSpeaking
                    ? 'Говорит прямо сейчас'
                    : 'В комнате'}
                </p>
              </div>
            </div>

            {/* Volume slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-4 h-4 text-blue-400" />
                  <span>Громкость участника</span>
                </span>
                <span className="font-mono font-bold text-blue-300">
                  {peerVolume}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={peerVolume}
                onChange={(e) => setPeerVolume(cachedMobilePeer.peerId, Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/15 accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>0% (Mute)</span>
                <span>100% (Норма)</span>
                <span>200% (Усиление)</span>
              </div>
            </div>

            {/* If peer is broadcasting their screen */}
            {isStreaming && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-300">Прямой эфир экрана</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleWatchPeer(cachedMobilePeer.peerId);
                      onClose();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      watchedPeerId === cachedMobilePeer.peerId
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 active:scale-95'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>{watchedPeerId === cachedMobilePeer.peerId ? 'Закрыть просмотр' : 'Смотреть стрим'}</span>
                  </button>
                </div>

                {/* Stream audio volume for this peer */}
                <div className="space-y-1.5 pt-1 border-t border-emerald-500/20">
                  <div className="flex items-center justify-between text-xs text-gray-300">
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Громкость трансляции</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-300 text-[11px]">
                      {streamVolume}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={streamVolume}
                    onChange={(e) => onStreamVolumeChange(cachedMobilePeer.peerId, Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/15 accent-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-3 sm:p-4 border-t border-white/10 flex-shrink-0 bg-slate-950/50 rounded-b-2xl">
            <button
              type="button"
              onClick={() => {
                setPeerVolume(cachedMobilePeer.peerId, peerVolume === 0 ? 100 : 0);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                peerVolume === 0
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 border-white/10 hover:text-white'
              }`}
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>{peerVolume === 0 ? 'Включить звук' : 'Заглушить'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-blue-600/30 active:scale-95 cursor-pointer"
            >
              Готово
            </button>
          </div>
        </>
      )}
    </Modal>
  );
});

MobilePeerVolumeModal.displayName = 'MobilePeerVolumeModal';
