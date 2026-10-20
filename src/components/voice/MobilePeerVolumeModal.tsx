import React, { memo } from 'react';
import { Volume2, VolumeX, Radio } from 'lucide-react';
import type { PeerInfo } from '../../types/protocol';
import { Modal } from '../Modal';
import { Button, VolumeSlider, Card, Badge } from '../ui';
import { getInitials } from './voiceUtils';

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
            icon={<Volume2 className="w-5 h-5" />}
            onClose={onClose}
          />

          <Modal.Body className="space-y-4">
            <Card variant="surface" className="flex items-center gap-3 p-3 select-none">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shadow-xs shrink-0 transition-all ${
                  cachedMobilePeer.isSpeaking && !cachedMobilePeer.isMuted && !cachedMobilePeer.isDeafened
                    ? 'ring-2 ring-(--accent) ring-offset-2 ring-offset-(--surface) text-(--bg) bg-(--accent)'
                    : cachedMobilePeer.isDeafened
                    ? 'bg-(--danger-soft) border border-(--danger-border) text-(--danger)'
                    : cachedMobilePeer.isMuted
                    ? 'bg-(--danger-soft) border border-(--danger-border) text-(--danger)'
                    : 'bg-(--elevated) border border-(--border) text-(--fg)'
                }`}
              >
                {getInitials(cachedMobilePeer.nickname)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-(--fg) font-semibold text-sm truncate">{cachedMobilePeer.nickname}</p>
                <p className="text-xs text-(--muted)">
                  {cachedMobilePeer.isDeafened
                    ? 'Заглушил весь звук'
                    : cachedMobilePeer.isMuted
                    ? 'Микрофон отключен'
                    : cachedMobilePeer.isSpeaking
                    ? 'Говорит прямо сейчас'
                    : 'В комнате'}
                </p>
              </div>
            </Card>

            {/* Volume slider */}
            <div className="space-y-2">
              <VolumeSlider
                label="Громкость участника"
                value={peerVolume}
                onChange={(val) => setPeerVolume(cachedMobilePeer.peerId, val)}
              />
              <div className="flex justify-between text-[10px] text-(--muted) font-mono">
                <span>0% (Mute)</span>
                <span>100% (Норма)</span>
                <span>200% (Усиление)</span>
              </div>
            </div>

            {/* If peer is broadcasting their screen */}
            {isStreaming && (
              <Card variant="flat" className="p-3 border-(--accent)/30 bg-(--accent-soft)/10 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="blue" size="sm" pulse icon={<Radio className="w-3.5 h-3.5" />}>
                    Прямой эфир экрана
                  </Badge>
                  <Button
                    variant={watchedPeerId === cachedMobilePeer.peerId ? 'danger' : 'primary'}
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
                <div className="pt-2 border-t border-(--border)">
                  <VolumeSlider
                    label="Громкость трансляции"
                    value={streamVolume}
                    max={100}
                    onChange={(val) => onStreamVolumeChange(cachedMobilePeer.peerId, val)}
                  />
                </div>
              </Card>
            )}
          </Modal.Body>

          <Modal.Footer className="justify-between">
            <Button
              variant={peerVolume === 0 ? 'danger' : 'secondary'}
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
