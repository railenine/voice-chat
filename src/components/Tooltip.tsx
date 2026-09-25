import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, memo } from 'react';
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
  const [isRendered, setIsRendered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const timeoutRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Minimum distance from window edges
    const VIEWPORT_MARGIN = 10;

    // Generous clearance from trigger.
    // 14px on bottom and right guarantees the OS mouse pointer body doesn't occlude the tooltip.
    const GAP_Y = 14;
    const GAP_X = 14;

    const spaceAbove = triggerRect.top - VIEWPORT_MARGIN;
    const spaceBelow = vh - triggerRect.bottom - VIEWPORT_MARGIN;
    const spaceLeft = triggerRect.left - VIEWPORT_MARGIN;
    const spaceRight = vw - triggerRect.right - VIEWPORT_MARGIN;

    // Dynamic auto-flip based on available viewport space
    let finalPlacement = position;

    if (position === 'top') {
      if (spaceAbove < tooltipHeight + GAP_Y && spaceBelow > spaceAbove) {
        finalPlacement = 'bottom';
      }
    } else if (position === 'bottom') {
      if (spaceBelow < tooltipHeight + GAP_Y && spaceAbove > spaceBelow) {
        finalPlacement = 'top';
      }
    } else if (position === 'left') {
      if (spaceLeft < tooltipWidth + GAP_X && spaceRight > spaceLeft) {
        finalPlacement = 'right';
      }
    } else if (position === 'right') {
      if (spaceRight < tooltipWidth + GAP_X && spaceLeft > spaceRight) {
        finalPlacement = 'left';
      }
    }

    let top = 0;
    let left = 0;

    if (finalPlacement === 'top') {
      top = triggerRect.top - GAP_Y - tooltipHeight;
      left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
    } else if (finalPlacement === 'bottom') {
      top = triggerRect.bottom + GAP_Y;
      left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
    } else if (finalPlacement === 'left') {
      top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
      left = triggerRect.left - GAP_X - tooltipWidth;
    } else if (finalPlacement === 'right') {
      top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
      left = triggerRect.right + GAP_X;
    }

    // Viewport boundary clamping: guarantees the tooltip is NEVER cut off by window borders
    const maxLeft = Math.max(VIEWPORT_MARGIN, vw - tooltipWidth - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, vh - tooltipHeight - VIEWPORT_MARGIN);

    const clampedLeft = Math.max(VIEWPORT_MARGIN, Math.min(maxLeft, left));
    const clampedTop = Math.max(VIEWPORT_MARGIN, Math.min(maxTop, top));

    setCoords({
      top: Math.round(clampedTop),
      left: Math.round(clampedLeft),
    });
    setIsRendered(true);
  }, [position, content, description, hotkey]);

  const handleMouseEnter = () => {
    if (disabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
    setIsRendered(false);
  };

  const handleMouseDown = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
    setIsRendered(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isVisible) {
      setIsRendered(false);
      return;
    }
    updatePosition();
  }, [isVisible, updatePosition]);

  useEffect(() => {
    if (!isVisible) return;
    const handleUpdate = () => {
      updatePosition();
    };
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isVisible, updatePosition]);

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
    onTouchStart: (e: React.TouchEvent) => {
      handleMouseDown();
      children.props.onTouchStart?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      handleMouseEnter();
      children.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      handleMouseLeave();
      children.props.onBlur?.(e);
    },
  });

  return (
    <>
      {child}
      {isVisible &&
        !disabled &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              visibility: isRendered ? 'visible' : 'hidden',
            }}
            className={`fixed z-[99999] pointer-events-none select-none ${className}`}
          >
            <div className="relative bg-slate-950/92 backdrop-blur-2xl border border-white/[0.15] text-white rounded-xl px-3.5 py-2 shadow-2xl shadow-black/80 max-w-[calc(100vw-24px)] sm:max-w-xs text-xs flex flex-col gap-1 ring-1 ring-white/10 overflow-hidden animate-scale-up">
              {/* Subtle top reflection line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

              <div className="flex items-center gap-2 justify-between">
                <span className="font-semibold text-white/95 text-xs tracking-wide">
                  {content}
                </span>
                {hotkey && (
                  <span className="text-[10px] font-mono font-medium text-cyan-300 bg-cyan-500/15 border border-cyan-400/25 px-1.5 py-0.5 rounded shadow-sm flex-shrink-0">
                    {hotkey}
                  </span>
                )}
              </div>
              {description && (
                <span className="text-[11px] text-slate-300/85 font-normal leading-relaxed break-words">
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
