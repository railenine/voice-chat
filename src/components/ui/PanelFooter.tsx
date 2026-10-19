import React, { memo } from 'react';

export interface PanelFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const PanelFooter = memo<PanelFooterProps>(({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`h-[69px] px-3 sm:px-4 border-t border-[var(--border)] bg-[var(--surface)]/75 backdrop-blur-xl flex items-center justify-between shrink-0 select-none text-[var(--fg)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

PanelFooter.displayName = 'PanelFooter';
