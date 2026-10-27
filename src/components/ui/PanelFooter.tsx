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
  const hasHeight = /(?:^|\s)h-/.test(className);
  const hasJustify = /(?:^|\s)justify-/.test(className);
  const hasPadding = /(?:^|\s)p[xye]?-/.test(className);

  return (
    <div
      className={`border-t border-(--border) bg-(--surface)/85 backdrop-blur-xl flex items-center shrink-0 select-none text-(--fg) ${
        hasHeight ? '' : 'h-17.25'
      } ${
        hasJustify ? '' : 'justify-between'
      } ${
        hasPadding ? '' : 'px-3 sm:px-4'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

PanelFooter.displayName = 'PanelFooter';
