import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  content: React.ReactNode;
  description?: string;
  hotkey?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  children: React.ReactElement;
  className?: string;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = memo(({
  content,
  description,
  hotkey,
  position = 'top',
  delay = 180,
  children,
  className = '',
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; transform: string }>({
    top: 0,
    left: 0,
    transform: '',
  });
  const timeoutRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const calculateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;
    let transform = '';

    switch (position) {
      case 'top':
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
        transform = 'translate(-50%, -100%)';
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
        transform = 'translate(-50%, 0)';
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - gap;
        transform = 'translate(-100%, -50%)';
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + gap;
        transform = 'translate(0, -50%)';
        break;
    }

    // Guard viewport boundaries
    if (position === 'top' || position === 'bottom') {
      left = Math.max(130, Math.min(window.innerWidth - 130, left));
    } else {
      top = Math.max(30, Math.min(window.innerHeight - 30, top));
    }

    setCoords({ top, left, transform });
  }, [position]);

  const handleMouseEnter = () => {
    if (disabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      calculateCoords();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  const handleMouseDown = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const handleUpdate = () => calculateCoords();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isVisible, calculateCoords]);

  const child = React.cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const { ref } = children as any;
      if (typeof ref === 'function') ref(node);
      else if (ref && 'current' in ref) ref.current = node;
    },
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter();
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave();
      children.props.onMouseLeave?.(e);
    },
    onMouseDown: (e: React.MouseEvent) => {
      handleMouseDown();
      children.props.onMouseDown?.(e);
    },
  });

  return (
    <>
      {child}
      {isVisible &&
        !disabled &&
        createPortal(
          <div
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: coords.transform,
            }}
            className={`fixed z-[99999] pointer-events-none transition-all duration-150 animate-scale-up ${className}`}
          >
            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/20 text-white rounded-xl px-3 py-2 shadow-2xl shadow-black/80 max-w-xs text-xs flex flex-col gap-1 ring-1 ring-white/10">
              <div className="flex items-center gap-2 justify-between">
                <span className="font-semibold text-white/95 text-xs tracking-wide">
                  {content}
                </span>
                {hotkey && (
                  <span className="text-[10px] font-mono font-medium text-blue-300 bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 rounded shadow-sm flex-shrink-0">
                    {hotkey}
                  </span>
                )}
              </div>
              {description && (
                <span className="text-[11px] text-gray-400 font-normal leading-relaxed">
                  {description}
                </span>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
});

Tooltip.displayName = 'Tooltip';
