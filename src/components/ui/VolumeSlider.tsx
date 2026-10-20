import React, { memo } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Tooltip } from '../Tooltip';

export interface VolumeSliderProps {
  value: number; // 0 to 200
  onChange: (value: number) => void;
  onToggleMute?: () => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  label?: string;
  showPercent?: boolean;
}

export const VolumeSlider = memo<VolumeSliderProps>(({
  value,
  onChange,
  onToggleMute,
  min = 0,
  max = 200,
  step = 5,
  className = '',
  label = 'Громкость',
  showPercent = true,
}) => {
  const isMuted = value === 0;
  const isBoosted = value > 100;
  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const trackBackground = isMuted
    ? 'var(--border)'
    : `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percent}%, var(--border) ${percent}%, var(--border) 100%)`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        {onToggleMute ? (
          <Tooltip content={isMuted ? 'Включить звук' : 'Заглушить'} position="top">
            <button
              type="button"
              onClick={onToggleMute}
              className="flex items-center gap-1.5 text-(--muted) hover:text-(--fg) transition-colors select-none font-medium cursor-pointer"
              aria-label={isMuted ? 'Включить звук' : 'Заглушить'}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-(--danger) shrink-0" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-(--accent) shrink-0" />
              )}
              <span>{label}</span>
            </button>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-1.5 text-(--muted) select-none font-medium cursor-default">
            <Volume2 className="w-3.5 h-3.5 text-(--accent) shrink-0" />
            <span>{label}</span>
          </div>
        )}

        {showPercent && (
          <span
            className={`font-mono text-[11px] ${
              isMuted
                ? 'text-(--danger) font-semibold'
                : isBoosted
                ? 'text-(--accent) font-bold'
                : 'text-(--accent) font-medium'
            }`}
          >
            {value}%
          </span>
        )}
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        aria-label={`${label}: ${value}%${isBoosted ? ' (Усиление)' : ''}`}
        style={{ background: trackBackground }}
        className="volume-slider-input w-full h-1.5 rounded-full appearance-none cursor-pointer transition-colors"
      />
    </div>
  );
});

VolumeSlider.displayName = 'VolumeSlider';
