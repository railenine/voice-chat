import React, { memo } from 'react';
import { Download } from 'lucide-react';
import { Tooltip } from '../Tooltip';

interface UpdateBadgeProps {
  version: string;
  onClick: () => void;
  className?: string;
}

export const UpdateBadge: React.FC<UpdateBadgeProps> = memo(({
  version,
  onClick,
  className = '',
}) => {
  return (
    <Tooltip
      content={`Доступно обновление v${version}`}
      description="Нажмите, чтобы посмотреть список изменений и установить"
      position="bottom"
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/40 transition-colors duration-150 cursor-pointer select-none ${className}`}
        aria-label={`Доступно обновление v${version}`}
      >
        <Download className="w-3 h-3 text-emerald-400 shrink-0" />
        <span>Обновление</span>
      </button>
    </Tooltip>
  );
});

UpdateBadge.displayName = 'UpdateBadge';
