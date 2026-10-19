import React, { memo } from 'react';

export type CardVariant = 'surface' | 'flat' | 'elevated' | 'glass';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2;
  variant?: CardVariant;
  interactive?: boolean;
}

export const Card = memo<CardProps>(({
  level,
  variant,
  interactive = false,
  className = '',
  children,
  onClick,
  ...props
}) => {
  // Resolve variant with backward compatibility for level={1 | 2}
  const resolvedVariant: CardVariant =
    variant || (level === 2 ? 'flat' : level === 1 ? 'glass' : 'surface');

  const variantClasses: Record<CardVariant, string> = {
    surface: 'bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-5',
    flat: 'bg-transparent border-0 p-0',
    elevated: 'bg-[var(--elevated)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-5 shadow-xl shadow-black/40',
    glass: 'bg-slate-950/45 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 p-4 sm:p-5',
  };

  const interactiveClasses = interactive
    ? 'hover:bg-[var(--fg-soft)] hover:border-[var(--fg)]/30 cursor-pointer active:translate-y-px transition-all duration-150'
    : '';

  return (
    <div
      onClick={onClick}
      className={`${variantClasses[resolvedVariant]} ${interactiveClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';
