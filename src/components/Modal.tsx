import React, { useEffect, useState, memo } from 'react';
import { X } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { Button } from './ui/Button';

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
    <div className={`flex items-center justify-between p-4 sm:p-5 border-b border-(--border) shrink-0 bg-(--surface) ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-9 h-9 rounded-(--radius) bg-(--accent-soft)/20 border border-(--accent)/30 flex items-center justify-center text-(--accent) shrink-0 shadow-xs">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-bold text-sm sm:text-base text-(--fg) leading-snug truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-(--muted) mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {children}
        {onClose && (
          <Tooltip content="Закрыть" position="left">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Закрыть"
            >
              <X className="w-4 h-4 text-(--muted) hover:text-(--fg)" />
            </Button>
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
    <div className={`p-4 sm:p-5 overflow-y-auto custom-scrollbar modal-content-scroll bg-(--bg)/40 text-(--fg) ${className}`}>
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
    <div className={`flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-(--border) shrink-0 bg-(--surface) rounded-b-[calc(var(--radius)+4px)] ${className}`}>
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
        className={`bg-(--surface)/95 backdrop-blur-2xl border border-(--border) rounded-[calc(var(--radius)+4px)] ${
          hasCustomMaxWidth ? '' : 'max-w-md'
        } w-full shadow-2xl shadow-black/80 text-(--fg) modal-wrapper flex flex-col overflow-hidden ${
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
