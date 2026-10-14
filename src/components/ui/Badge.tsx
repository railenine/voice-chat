import React, { memo } from 'react';

export type BadgeVariant = 'emerald' | 'blue' | 'amber' | 'rose' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  pulse?: boolean;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  title?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; pulseDot: string }> = {
  emerald: {
    container:
      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
    pulseDot: 'bg-emerald-400',
  },
  blue: {
    container:
      'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25',
    pulseDot: 'bg-blue-400',
  },
  amber: {
    container:
      'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
    pulseDot: 'bg-amber-400',
  },
  rose: {
    container:
      'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25',
    pulseDot: 'bg-rose-400',
  },
  neutral: {
    container:
      'bg-white/6 text-gray-300 border-white/10 hover:bg-white/12',
    pulseDot: 'bg-gray-400',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'h-5 px-1.5 text-[10px] gap-1 rounded-md leading-none',
  md: 'h-6 px-2.5 text-xs gap-1.5 rounded-lg leading-none',
};

export const Badge = memo<BadgeProps>(({
  variant = 'neutral',
  size = 'md',
  icon,
  pulse = false,
  children,
  onClick,
  className = '',
  title,
}) => {
  const styles = variantStyles[variant];
  const isInteractive = Boolean(onClick);

  const baseClasses = `btn-compact !min-h-0 !min-w-0 inline-flex items-center justify-center font-medium border transition-colors select-none shrink-0 ${
    styles.container
  } ${sizeStyles[size]} ${isInteractive ? 'cursor-pointer active:scale-95' : 'cursor-default'} ${className}`;

  const content = (
    <>
      {pulse && (
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${styles.pulseDot}`} />
      )}
      {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}
      <span className="truncate">{children}</span>
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={baseClasses}
        title={title}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={baseClasses} title={title}>
      {content}
    </span>
  );
});

Badge.displayName = 'Badge';
