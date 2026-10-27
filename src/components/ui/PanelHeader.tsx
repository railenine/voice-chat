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
  const hasHeight = /(?:^|\s)h-/.test(className);
  const hasJustify = /(?:^|\s)justify-/.test(className);
  const hasPadding = /(?:^|\s)p[xye]?-/.test(className);

  return (
    <div
      className={`border-b border-(--border) bg-(--surface) flex items-center shrink-0 select-none text-(--fg) ${
        hasHeight ? '' : 'h-16'
      } ${
        hasJustify ? '' : 'justify-between'
      } ${
        hasPadding ? '' : 'px-4 sm:px-5'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

PanelHeader.displayName = 'PanelHeader';
