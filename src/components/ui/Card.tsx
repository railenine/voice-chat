import React, { memo } from 'react';

export type CardVariant = 'surface' | 'flat' | 'elevated' | 'glass' | 'soft';

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
    surface: 'bg-(--surface) border border-(--border) rounded-lg p-4 sm:p-5',
    flat: 'bg-transparent border-0 p-0',
    soft: 'bg-(--fg-soft) border border-(--border) rounded-(--radius) p-3.5',
    elevated: 'bg-(--elevated) border border-(--border) rounded-lg p-4 sm:p-5 shadow-xl shadow-black/40',
    glass: 'bg-(--surface)/60 backdrop-blur-xl border border-(--border) rounded-lg shadow-xl shadow-black/40 p-4 sm:p-5',
  };

  const interactiveClasses = interactive
    ? 'hover:bg-(--fg-soft) hover:border-(--fg)/30 cursor-pointer active:translate-y-px transition-all duration-150'
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
