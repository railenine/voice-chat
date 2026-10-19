import React, { memo } from 'react';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface LogoProps {
  size?: LogoSize;
  className?: string;
  alt?: string;
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
}) => {
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
