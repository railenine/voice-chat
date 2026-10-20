import React, { memo } from 'react';
import { Users, Info, ShieldAlert } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { MAX_ROOM_PEERS } from '../../config';
import { getRoomCapacityStatus } from '../../utils/capacityPolicy';

export interface VoiceCapacityBadgeProps {
  count: number;
  max?: number;
  micCount: number;
}

export const VoiceCapacityBadge: React.FC<VoiceCapacityBadgeProps> = memo(({
  count,
  max = MAX_ROOM_PEERS,
  micCount,
}) => {
  const { isFull, isMeshHeavy } = getRoomCapacityStatus(count, max);

  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[11px] font-semibold text-(--muted) uppercase tracking-wider truncate">
          Участники ({count}/{max})
        </span>

        {isFull ? (
          <Tooltip
            content="Комната заполнена (12/12)"
            description="Достигнут предел P2P Full-Mesh сети (12 участников). Новые подключения отклоняются до освобождения места."
            position="bottom"
          >
            <span className="inline-flex items-center gap-1 text-[10px] bg-(--danger-soft) text-(--danger) border border-(--danger-border) px-1.5 py-0.2 rounded font-mono font-semibold cursor-default">
              <ShieldAlert className="w-2.5 h-2.5 text-(--danger)" />
              Лимит
            </span>
          </Tooltip>
        ) : isMeshHeavy ? (
          <Tooltip
            content={`Mesh P2P (${count} уч.)`}
            description="В комнате 8+ участников. P2P mesh-сеть передаёт независимые аудиопотоки напрямую каждому клиенту."
            position="bottom"
          >
            <span className="inline-flex items-center gap-1 text-[10px] bg-(--warning-soft) text-(--warning) border border-(--warning-border) px-1.5 py-0.2 rounded font-mono cursor-default">
              <Info className="w-2.5 h-2.5 text-(--warning)" />
              Mesh (8+)
            </span>
          </Tooltip>
        ) : null}
      </div>

      <span className="text-[10px] text-(--accent) font-mono shrink-0">
        {micCount} с микрофоном
      </span>
    </div>
  );
});

VoiceCapacityBadge.displayName = 'VoiceCapacityBadge';
