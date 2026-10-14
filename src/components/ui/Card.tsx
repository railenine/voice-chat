import React, { memo } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2;
  interactive?: boolean;
}

export const Card = memo<CardProps>(({
  level = 1,
  interactive = false,
  className = '',
  children,
  onClick,
  ...props
}) => {
  const levelClasses =
    level === 1
      ? 'bg-slate-950/45 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40'
      : 'bg-white/4 border border-white/10 rounded-xl';

  const interactiveClasses = interactive
    ? 'hover:bg-white/8 hover:border-white/15 cursor-pointer active:scale-[0.99] transition-all duration-150'
    : '';

  return (
    <div
      onClick={onClick}
      className={`${levelClasses} ${interactiveClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';
