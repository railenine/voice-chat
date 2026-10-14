import React, { memo } from 'react';
import { Volume2, VolumeX, Radio } from 'lucide-react';
import type { PeerInfo } from '../../types/protocol';
import { Modal } from '../Modal';
import { Button, VolumeSlider } from '../ui';
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
          <Modal.Header
            title={`Громкость: ${cachedMobilePeer.nickname}`}
            icon={<Volume2 className="w-5 h-5 text-blue-400" />}
            onClose={onClose}
          />

          <Modal.Body className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base bg-linear-to-br ${getAvatarGradient(
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
              <VolumeSlider
                label="Громкость участника"
                value={peerVolume}
                onChange={(val) => setPeerVolume(cachedMobilePeer.peerId, val)}
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
                  <Button
                    variant={watchedPeerId === cachedMobilePeer.peerId ? 'danger' : 'emerald'}
                    size="sm"
                    icon={<Radio className="w-3.5 h-3.5" />}
                    onClick={() => {
                      onToggleWatchPeer(cachedMobilePeer.peerId);
                      onClose();
                    }}
                  >
                    {watchedPeerId === cachedMobilePeer.peerId ? 'Закрыть просмотр' : 'Смотреть стрим'}
                  </Button>
                </div>

                {/* Stream audio volume for this peer */}
                <div className="pt-1 border-t border-emerald-500/20">
                  <VolumeSlider
                    label="Громкость трансляции"
                    value={streamVolume}
                    max={100}
                    onChange={(val) => onStreamVolumeChange(cachedMobilePeer.peerId, val)}
                  />
                </div>
              </div>
            )}
          </Modal.Body>

          <Modal.Footer className="justify-between">
            <Button
              variant={peerVolume === 0 ? 'danger' : 'glass'}
              size="md"
              icon={<VolumeX className="w-3.5 h-3.5" />}
              onClick={() => {
                setPeerVolume(cachedMobilePeer.peerId, peerVolume === 0 ? 100 : 0);
              }}
            >
              {peerVolume === 0 ? 'Включить звук' : 'Заглушить'}
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onClose}
            >
              Готово
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
});

MobilePeerVolumeModal.displayName = 'MobilePeerVolumeModal';
