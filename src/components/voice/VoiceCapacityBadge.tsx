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
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">
          Участники ({count}/{max})
        </span>

        {isFull ? (
          <Tooltip
            content="Комната заполнена (12/12)"
            description="Достигнут предел P2P Full-Mesh сети (12 участников). Новые подключения отклоняются до освобождения места."
            position="bottom"
          >
            <span className="inline-flex items-center gap-1 text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.2 rounded font-mono font-semibold cursor-default">
              <ShieldAlert className="w-2.5 h-2.5 text-rose-400" />
              Лимит
            </span>
          </Tooltip>
        ) : isMeshHeavy ? (
          <Tooltip
            content={`Mesh P2P (${count} уч.)`}
            description="В комнате 8+ участников. P2P mesh-сеть передаёт независимые аудиопотоки напрямую каждому клиенту."
            position="bottom"
          >
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono cursor-default">
              <Info className="w-2.5 h-2.5 text-amber-400" />
              Mesh (8+)
            </span>
          </Tooltip>
        ) : null}
      </div>

      <span className="text-[10px] text-blue-400 font-mono flex-shrink-0">
        {micCount} с микрофоном
      </span>
    </div>
  );
});

VoiceCapacityBadge.displayName = 'VoiceCapacityBadge';
