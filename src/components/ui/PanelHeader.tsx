import React, { memo } from 'react';

export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const PanelHeader = memo<PanelHeaderProps>(({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`h-16 px-4 sm:px-5 border-b border-(--border) bg-(--surface)/75 backdrop-blur-xl flex items-center justify-between shrink-0 select-none text-(--fg) ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

PanelHeader.displayName = 'PanelHeader';
