import React, { useEffect, useState, useRef, memo } from 'react';
import { isTauri } from '../config';
import { UpdateInfo, UpdateStatus } from '../utils/updaterTypes';
import { UpdateModalHeader } from './updater/UpdateModalHeader';
import { UpdateModalBody } from './updater/UpdateModalBody';
import { UpdateModalFooter } from './updater/UpdateModalFooter';

export interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  downloadedBytes: number;
  totalBytes: number;
  error: string | null;
  isPortable?: boolean;
  isInRoom?: boolean;
  onInstall: (mode?: 'portable' | 'installer') => void;
  onCheckAgain: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = memo(({
  isOpen,
  onClose,
  status,
  updateInfo,
  downloadProgress,
  downloadedBytes,
  totalBytes,
  error,
  isPortable = false,
  isInRoom = false,
  onInstall,
  onCheckAgain,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [renderedStatus, setRenderedStatus] = useState<UpdateStatus>(status);
  const [fadeState, setFadeState] = useState<'visible' | 'fading-out' | 'fading-in'>('visible');
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      setRenderedStatus(status);
      setFadeState('visible');
    } else if (isRendered) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered]);

  // Smooth cross-fade when status changes while modal is open
  useEffect(() => {
    if (!isOpen) return;

    if (status !== renderedStatus) {
      setFadeState('fading-out');
      const timer = setTimeout(() => {
        setRenderedStatus(status);
        setFadeState('fading-in');
        const inTimer = setTimeout(() => {
          setFadeState('visible');
        }, 220);
        return () => clearTimeout(inTimer);
      }, 140);
      return () => clearTimeout(timer);
    }
  }, [status, renderedStatus, isOpen]);

  // Track natural content height for smooth zero-jerk height transitions
  useEffect(() => {
    if (!contentRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h > 0) {
          setContentHeight(h);
        }
      }
    });
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [renderedStatus, isRendered]);

  if (!isRendered) return null;

  const isDesktop = isTauri();
  const isLockedProgress = renderedStatus === 'downloading' || renderedStatus === 'installing';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md ${
        isClosing ? 'animate-backdrop-out pointer-events-none' : 'animate-backdrop-in'
      }`}
      onClick={isLockedProgress ? undefined : onClose}
    >
      <div
        className={`bg-slate-950/90 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-md w-full shadow-2xl shadow-black/80 p-5 sm:p-6 text-white select-none modal-wrapper ${
          isClosing ? 'animate-modal-out' : 'animate-modal-in'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <UpdateModalHeader
          status={renderedStatus}
          fadeState={fadeState}
          updateInfo={updateInfo}
          isDesktop={isDesktop}
          isPortable={isPortable}
          onClose={onClose}
        />

        {/* Dynamic Content Body with Smooth Height Transition */}
        <div
          className="overflow-hidden transition-[height] duration-300 ease-out mb-5"
          style={{ height: contentHeight !== undefined ? `${contentHeight}px` : 'auto' }}
        >
          <UpdateModalBody
            ref={contentRef}
            status={renderedStatus}
            fadeState={fadeState}
            updateInfo={updateInfo}
            downloadProgress={downloadProgress}
            downloadedBytes={downloadedBytes}
            totalBytes={totalBytes}
            error={error}
            isDesktop={isDesktop}
            isPortable={isPortable}
            isInRoom={isInRoom}
          />
        </div>

        <UpdateModalFooter
          status={renderedStatus}
          fadeState={fadeState}
          isDesktop={isDesktop}
          isPortable={isPortable}
          onClose={onClose}
          onInstall={onInstall}
          onCheckAgain={onCheckAgain}
        />
      </div>
    </div>
  );
});

UpdateModal.displayName = 'UpdateModal';
export default UpdateModal;
