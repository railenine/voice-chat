import React, { memo } from 'react';
import { Download } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { Badge } from '../ui/Badge';

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
      <Badge
        variant="blue"
        size="sm"
        pulse
        onClick={onClick}
        icon={<Download className="w-3 h-3 text-[var(--accent)] shrink-0" />}
        className={`max-[420px]:px-1.5 ${className}`}
      >
        <span className="max-[420px]:hidden">Обновление</span>
      </Badge>
    </Tooltip>
  );
});

UpdateBadge.displayName = 'UpdateBadge';
