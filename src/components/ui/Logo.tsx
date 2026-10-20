import React, { memo } from 'react';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface LogoProps {
  size?: LogoSize;
  className?: string;
  alt?: string;
  animated?: boolean;
}

const SIZE_MAP: Record<LogoSize, string> = {
  xs: 'w-4 h-4',
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-11 h-11',
  xl: 'w-16 h-16 sm:w-20 sm:h-20',
};

export const Logo: React.FC<LogoProps> = memo(({
  size = 'md',
  className = '',
  alt = 'RVxis',
  animated = false,
}) => {
  if (animated) {
    return (
      <svg
        viewBox="0 0 512 512"
        fill="none"
        role="img"
        aria-label={alt}
        className={`shrink-0 select-none ${SIZE_MAP[size]} ${className}`}
      >
        {/* Outer static circle */}
        <circle
          cx="256"
          cy="256"
          r="210"
          stroke="var(--accent)"
          strokeWidth="36"
        />
        {/* Outer semicircle rotating clockwise around center */}
        <g className="animate-spin-cw">
          <path
            d="M 256 118 A 138 138 0 0 1 256 394"
            stroke="var(--accent)"
            strokeWidth="34"
            strokeLinecap="butt"
          />
        </g>
        {/* Inner semicircle rotating counter-clockwise around center */}
        <g className="animate-spin-ccw">
          <path
            d="M 256 184 A 72 72 0 0 1 256 328"
            stroke="var(--accent)"
            strokeWidth="34"
            strokeLinecap="butt"
          />
        </g>
      </svg>
    );
  }

  return (
    <img
      src="/icon.png"
      alt={alt}
      draggable={false}
      className={`shrink-0 object-contain rounded-full select-none ${SIZE_MAP[size]} ${className}`}
    />
  );
});

Logo.displayName = 'Logo';
