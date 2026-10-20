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
      'bg-(--success-soft) text-(--success) border-(--success-border) hover:bg-(--success)/20',
    pulseDot: 'bg-(--success)',
  },
  blue: {
    container:
      'bg-(--accent-soft) text-(--accent) border-(--accent)/30 hover:bg-(--accent)/20',
    pulseDot: 'bg-(--accent)',
  },
  amber: {
    container:
      'bg-(--warning-soft) text-(--warning) border-(--warning-border) hover:bg-(--warning)/20',
    pulseDot: 'bg-(--warning)',
  },
  rose: {
    container:
      'bg-(--danger-soft) text-(--danger) border-(--danger-border) hover:bg-(--danger)/20',
    pulseDot: 'bg-(--danger)',
  },
  neutral: {
    container:
      'bg-transparent text-(--muted) border-(--border) hover:bg-(--fg-soft)',
    pulseDot: 'bg-(--muted)',
  },
  pill: {
    container:
      'bg-(--accent-soft) text-(--accent) border-transparent font-mono rounded-full',
    pulseDot: 'bg-(--accent)',
  },
  tag: {
    container:
      'bg-transparent text-(--muted) border-(--border) rounded-full hover:border-(--fg)/30',
    pulseDot: 'bg-gray-400',
  },
  accent: {
    container:
      'bg-(--accent) text-(--bg) font-semibold border-transparent',
    pulseDot: 'bg-(--bg)',
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

  const baseClasses = `btn-compact min-h-0! min-w-0! inline-flex items-center justify-center font-medium border transition-colors select-none shrink-0 ${
    styles.container
  } ${sizeStyles[size]} ${isInteractive ? 'cursor-pointer active:scale-95 focus:outline-none focus-visible:outline-2 focus-visible:outline-(--accent) focus-visible:outline-offset-1' : 'cursor-default'} ${className}`;

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
