import React, { memo } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

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

  const valueColor = isMuted
    ? 'text-red-400'
    : isBoosted
    ? 'text-emerald-400 font-bold'
    : 'text-blue-300';

  const accentColor = isBoosted
    ? 'bg-emerald-500/25 accent-emerald-400'
    : 'bg-white/15 accent-blue-500';

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onToggleMute}
          className={`flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer select-none font-medium ${
            onToggleMute ? 'cursor-pointer' : 'cursor-default'
          }`}
          title={onToggleMute ? (isMuted ? 'Включить звук' : 'Заглушить') : label}
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-blue-300 shrink-0" />
          )}
          <span>{label}</span>
        </button>

        {showPercent && (
          <span className={`font-mono font-semibold text-[11px] ${valueColor}`}>
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
        title={`${label}: ${value}%${isBoosted ? ' (Усиление)' : ''}`}
        className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-all ${accentColor}`}
      />
    </div>
  );
});

VolumeSlider.displayName = 'VolumeSlider';
