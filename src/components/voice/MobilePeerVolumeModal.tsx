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
                    ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)] text-[var(--bg)] bg-[var(--accent)]'
                    : cachedMobilePeer.isDeafened
                    ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                    : cachedMobilePeer.isMuted
                    ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                    : 'bg-[var(--elevated)] border border-[var(--border)] text-[var(--fg)]'
                }`}
              >
                {getInitials(cachedMobilePeer.nickname)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[var(--fg)] font-semibold text-sm truncate">{cachedMobilePeer.nickname}</p>
                <p className="text-xs text-[var(--muted)]">
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
              <div className="flex justify-between text-[10px] text-[var(--muted)] font-mono">
                <span>0% (Mute)</span>
                <span>100% (Норма)</span>
                <span>200% (Усиление)</span>
              </div>
            </div>

            {/* If peer is broadcasting their screen */}
            {isStreaming && (
              <Card variant="flat" className="p-3 border-[var(--accent)]/30 bg-[var(--accent-soft)]/10 space-y-3">
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
                <div className="pt-2 border-t border-[var(--border)]">
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
