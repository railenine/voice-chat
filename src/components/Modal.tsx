import React, { useEffect, useState, memo } from 'react';
import { X } from 'lucide-react';
import { Tooltip } from './Tooltip';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
}

export interface ModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalHeader = memo<ModalHeaderProps>(({
  title,
  subtitle,
  icon,
  onClose,
  className = '',
  children,
}) => {
  return (
    <div className={`flex items-center justify-between p-4 sm:p-5 border-b border-white/10 shrink-0 bg-white/2 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-sm">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-bold text-sm sm:text-base text-white leading-snug truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {children}
        {onClose && (
          <Tooltip content="Закрыть" position="left">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer select-none"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
});

ModalHeader.displayName = 'ModalHeader';

export const ModalBody = memo<ModalBodyProps>(({
  children,
  className = '',
}) => {
  return (
    <div className={`p-4 sm:p-5 overflow-y-auto custom-scrollbar modal-content-scroll ${className}`}>
      {children}
    </div>
  );
});

ModalBody.displayName = 'ModalBody';

export const ModalFooter = memo<ModalFooterProps>(({
  children,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-white/10 shrink-0 bg-slate-950/50 rounded-b-2xl ${className}`}>
      {children}
    </div>
  );
});

ModalFooter.displayName = 'ModalFooter';

interface ModalComponent extends React.FC<ModalProps> {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
}

export const Modal: ModalComponent = (({
  isOpen,
  onClose,
  children,
  className = '',
  closeOnOverlayClick = true,
  closeOnEsc = true,
}: ModalProps) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
    } else if (isRendered) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen || isClosing || !closeOnEsc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isClosing, closeOnEsc, onClose]);

  if (!isRendered) return null;

  const hasCustomMaxWidth = className && /\bmax-w-/.test(className);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md ${
        isClosing ? 'animate-backdrop-out pointer-events-none' : 'animate-backdrop-in'
      }`}
      onClick={closeOnOverlayClick ? onClose : undefined}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-slate-950/90 backdrop-blur-2xl border border-white/15 rounded-2xl ${
          hasCustomMaxWidth ? '' : 'max-w-md'
        } w-full shadow-2xl shadow-black/80 text-white modal-wrapper flex flex-col overflow-hidden ${
          isClosing ? 'animate-modal-out' : 'animate-modal-in'
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}) as ModalComponent;

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
