import React, { memo } from 'react';

export type BadgeVariant =
  | 'emerald'
  | 'blue'
  | 'amber'
  | 'rose'
  | 'neutral'
  | 'pill'
  | 'tag'
  | 'accent';
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
      'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30 hover:bg-[var(--accent)]/20',
    pulseDot: 'bg-[var(--accent)]',
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
      'bg-transparent text-[var(--muted)] border-[var(--border)] hover:bg-[var(--fg-soft)]',
    pulseDot: 'bg-gray-400',
  },
  pill: {
    container:
      'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent font-mono rounded-full',
    pulseDot: 'bg-[var(--accent)]',
  },
  tag: {
    container:
      'bg-transparent text-[var(--muted)] border-[var(--border)] rounded-full hover:border-[var(--fg)]/30',
    pulseDot: 'bg-gray-400',
  },
  accent: {
    container:
      'bg-[var(--accent)] text-[var(--bg)] font-semibold border-transparent',
    pulseDot: 'bg-[var(--bg)]',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'h-5 px-2 text-[10px] gap-1 rounded-full leading-none',
  md: 'h-6 px-2.5 text-xs gap-1.5 rounded-full leading-none',
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
