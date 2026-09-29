import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Volume2,
  VolumeX,
  Info,
  X,
  Check,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  ScreenShareQualityPreset,
  StartScreenShareOptions,
  SCREEN_SHARE_PRESETS,
} from '../hooks/useScreenShare';
import { Modal } from './Modal';

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: StartScreenShareOptions) => void;
  isConnecting?: boolean;
}

const STORAGE_QUALITY_KEY = 'voice_chat_screenshare_quality';
const STORAGE_AUDIO_KEY = 'voice_chat_screenshare_audio';

const PRESET_ORDER: ScreenShareQualityPreset[] = [
  '1440p30',
  '1080p60',
  '1080p30',
  '720p30',
];

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isConnecting = false,
}) => {
  // Load saved preferences or defaults
  const [selectedQuality, setSelectedQuality] = useState<ScreenShareQualityPreset>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_QUALITY_KEY);
      if (saved && saved in SCREEN_SHARE_PRESETS) {
        return saved as ScreenShareQualityPreset;
      }
    } catch (e) {}
    return '1080p60';
  });

  const [includeAudio, setIncludeAudio] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_AUDIO_KEY);
      if (saved !== null) {
        return saved === 'true';
      }
    } catch (e) {}
    return true;
  });

  // Re-sync on open
  useEffect(() => {
    if (isOpen) {
      try {
        const savedQ = localStorage.getItem(STORAGE_QUALITY_KEY);
        if (savedQ && savedQ in SCREEN_SHARE_PRESETS) {
          setSelectedQuality(savedQ as ScreenShareQualityPreset);
        }
        const savedA = localStorage.getItem(STORAGE_AUDIO_KEY);
        if (savedA !== null) {
          setIncludeAudio(savedA === 'true');
        }
      } catch (e) {}
    }
  }, [isOpen]);

  const handleConfirm = () => {
    try {
      localStorage.setItem(STORAGE_QUALITY_KEY, selectedQuality);
      localStorage.setItem(STORAGE_AUDIO_KEY, String(includeAudio));
    } catch (e) {}

    onConfirm({
      quality: selectedQuality,
      includeAudio,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-0 overflow-hidden">
      <div className="p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 flex-shrink-0">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Параметры трансляции
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Настройте качество видео и звук перед выбором экрана
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer -mr-1 -mt-1"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Resolution & FPS Presets */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Качество и частота кадров</span>
            </label>
            <span className="text-[11px] text-gray-400 font-mono">
              {SCREEN_SHARE_PRESETS[selectedQuality]?.width}×
              {SCREEN_SHARE_PRESETS[selectedQuality]?.height} •{' '}
              {SCREEN_SHARE_PRESETS[selectedQuality]?.frameRate} FPS
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRESET_ORDER.map((key) => {
              const preset = SCREEN_SHARE_PRESETS[key];
              const isSelected = selectedQuality === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedQuality(key)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-1.5 active:scale-[0.98] ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500/70 ring-1 ring-blue-500/40 shadow-lg shadow-blue-950/40'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold tracking-tight ${
                        isSelected ? 'text-white' : 'text-gray-200'
                      }`}
                    >
                      {preset.label}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isSelected
                          ? 'bg-blue-500/30 border-blue-400/50 text-blue-200 font-bold'
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      {preset.badge}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">
                    {preset.desc}
                  </p>

                  {/* Selected Indicator Checkmark */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm opacity-0 pointer-events-none">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Audio Toggle Switch */}
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors hover:border-white/15">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                includeAudio
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10'
              }`}
            >
              {includeAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-white block">
                Транслировать системный звук
              </span>
              <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                Звуки открытых игр, музыки и видео будут слышны собеседникам
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={includeAudio}
            onClick={() => setIncludeAudio(!includeAudio)}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 flex-shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
              includeAudio ? 'bg-emerald-500' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                includeAudio ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Section 3: Informative Notice */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5 text-xs text-blue-200/90 leading-relaxed">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <span>
            На следующем шаге подтвердите выбор конкретного окна или всего экрана в системном диалоге.
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isConnecting}
            className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConnecting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-blue-500/30 border border-blue-400/40 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Запуск...</span>
              </>
            ) : (
              <>
                <Monitor className="w-4 h-4" />
                <span>Выбрать экран</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
