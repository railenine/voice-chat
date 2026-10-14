import React, { useState, memo } from 'react';
import { Image as ImageIcon, Video, ExternalLink, Copy, Check, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { Button, Badge } from './ui';
import { resolveMediaUrl, openExternalUrl, isDomainTrusted } from '../utils/chatMediaUtils';
import { ExternalLinkModal } from './ExternalLinkModal';

export interface MediaViewerItem {
  url: string;
  type: 'image' | 'video' | 'gif';
  name?: string;
  senderNickname?: string;
  timestamp?: number;
}

export interface MediaViewerModalProps {
  item: MediaViewerItem | null;
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = memo(({
  item,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmExternalUrl, setConfirmExternalUrl] = useState<string | null>(null);

  if (!item) return null;

  const resolvedUrl = resolveMediaUrl(item.url);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(resolvedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy media link:', err);
    }
  };

  const handleOpenInBrowser = () => {
    if (isDomainTrusted(resolvedUrl)) {
      openExternalUrl(resolvedUrl);
    } else {
      setConfirmExternalUrl(resolvedUrl);
    }
  };

  const badgeVariant = item.type === 'video' ? 'emerald' : item.type === 'gif' ? 'amber' : 'blue';
  const typeLabel = item.type === 'video' ? 'ВИДЕО' : item.type === 'gif' ? 'GIF' : 'ФОТО';

  return (
    <>
      <Modal
        isOpen={Boolean(item)}
        onClose={onClose}
        className="max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden"
      >
        <Modal.Header
          title={item.name || (item.type === 'video' ? 'Видеозапись' : item.type === 'gif' ? 'GIF-анимация' : 'Изображение')}
          subtitle={item.senderNickname ? `Отправил(а): ${item.senderNickname}` : undefined}
          icon={
            item.type === 'video' ? (
              <Video className="w-4 h-4 text-emerald-400" />
            ) : item.type === 'gif' ? (
              <Sparkles className="w-4 h-4 text-amber-400" />
            ) : (
              <ImageIcon className="w-4 h-4 text-blue-400" />
            )
          }
          onClose={onClose}
        >
          <Badge variant={badgeVariant} size="sm">
            {typeLabel}
          </Badge>
        </Modal.Header>

        <Modal.Body className="p-2 sm:p-4 bg-black/60 flex items-center justify-center min-h-60 max-h-[calc(92vh-140px)] overflow-hidden">
          {item.type === 'video' ? (
            <video
              src={resolvedUrl}
              controls
              autoPlay
              playsInline
              // @ts-expect-error referrerPolicy is valid HTML5 attribute for video elements
              referrerPolicy="no-referrer"
              className="max-h-[calc(92vh-160px)] max-w-full rounded-xl shadow-2xl object-contain bg-black"
            />
          ) : (
            <img
              src={resolvedUrl}
              alt={item.name || 'Медиа'}
              className="max-h-[calc(92vh-160px)] max-w-full rounded-xl shadow-2xl object-contain select-none"
              loading="eager"
              referrerPolicy="no-referrer"
            />
          )}
        </Modal.Body>

        <Modal.Footer className="justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="glass"
              size="md"
              icon={copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              onClick={handleCopyLink}
            >
              {copied ? 'Скопировано!' : 'Копировать ссылку'}
            </Button>

            <Button
              variant="glass"
              size="md"
              icon={<ExternalLink className="w-4 h-4" />}
              onClick={handleOpenInBrowser}
            >
              В браузере
            </Button>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={onClose}
          >
            Закрыть
          </Button>
        </Modal.Footer>
      </Modal>

      <ExternalLinkModal
        url={confirmExternalUrl}
        onClose={() => setConfirmExternalUrl(null)}
      />
    </>
  );
});

MediaViewerModal.displayName = 'MediaViewerModal';
