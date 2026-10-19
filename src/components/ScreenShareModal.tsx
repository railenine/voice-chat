import React, { useState, useEffect, memo } from 'react';
import {
  Monitor,
  Info,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  ScreenShareQualityPreset,
  StartScreenShareOptions,
  SCREEN_SHARE_PRESETS,
} from '../hooks/useScreenShare';
import { Modal } from './Modal';
import { Button, Badge } from './ui';

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: StartScreenShareOptions) => void;
  isConnecting?: boolean;
}

const STORAGE_QUALITY_KEY = 'voice_chat_screenshare_quality';

const PRESET_ORDER: ScreenShareQualityPreset[] = [
  '1440p30',
  '1080p60',
  '1080p30',
  '720p30',
];

export const ScreenShareModal: React.FC<ScreenShareModalProps> = memo(({
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
    } catch (e) { }
    return '1080p60';
  });

  // Re-sync on open
  useEffect(() => {
    if (isOpen) {
      try {
        const savedQ = localStorage.getItem(STORAGE_QUALITY_KEY);
        if (savedQ && savedQ in SCREEN_SHARE_PRESETS) {
          setSelectedQuality(savedQ as ScreenShareQualityPreset);
        }
      } catch (e) { }
    }
  }, [isOpen]);

  const handleConfirm = () => {
    try {
      localStorage.setItem(STORAGE_QUALITY_KEY, selectedQuality);
    } catch (e) { }

    onConfirm({
      quality: selectedQuality,
      includeAudio: true,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-lg w-full flex flex-col overflow-hidden"
    >
      <Modal.Header
        title="Параметры трансляции"
        subtitle="Выберите качество видео и частоту кадров"
        icon={<Monitor className="w-5 h-5 text-[var(--accent)]" />}
        onClose={onClose}
      />

      <Modal.Body className="p-4 sm:p-5 space-y-4">
        {/* Section 1: Resolution & FPS Presets */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Качество и частота кадров</span>
            </label>
            <span className="text-[11px] text-[var(--muted)] font-mono">
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
                  className={`p-3 rounded-[var(--radius)] border text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between gap-1.5 active:scale-[0.98] ${
                    isSelected
                      ? 'bg-[var(--accent-soft)]/20 border-[var(--accent)] ring-1 ring-[var(--accent)]/40 shadow-xs'
                      : 'bg-[var(--surface)]/60 hover:bg-[var(--surface)] border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold tracking-tight transition-colors duration-200 ${
                        isSelected ? 'text-[var(--fg)]' : 'text-[var(--muted)]'
                      }`}
                    >
                      {preset.label}
                    </span>
                    <Badge
                      variant={isSelected ? 'blue' : 'tag'}
                      size="sm"
                    >
                      {preset.badge}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-[var(--muted)] leading-snug line-clamp-2">
                    {preset.desc}
                  </p>

                  {/* Selected Indicator Checkmark */}
                  <div
                    className={`absolute bottom-2.5 right-2.5 w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center shadow-xs transition-all duration-200 pointer-events-none ${
                      isSelected
                        ? 'opacity-100 scale-100 rotate-0'
                        : 'opacity-0 scale-50 -rotate-45'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5 stroke-3" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Informative Notice & Audio Guidance */}
        <div className="space-y-2 animate-tab-fade">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-[var(--radius)] flex items-start gap-2.5 text-xs text-amber-200/90 leading-relaxed">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <span>
              <strong className="font-semibold text-amber-300">Звук трансляции:</strong> если требуется передавать звук, отметьте галочку общего доступа к аудио в следующем окне выбора. Для изоляции звука видео или музыки выбирайте вкладку браузера.
            </span>
          </div>
          <div className="p-2.5 bg-[var(--accent-soft)]/10 border border-[var(--accent)]/20 rounded-[var(--radius)] flex items-start gap-2.5 text-[11px] text-[var(--fg)]/80 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-[var(--accent)] mt-0.5 shrink-0" />
            <span>
              На следующем шаге подтвердите выбор конкретного окна, вкладки или всего экрана в системном диалоге.
            </span>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer className="justify-end gap-2.5">
        <Button
          variant="glass"
          size="md"
          onClick={onClose}
          disabled={isConnecting}
        >
          Отмена
        </Button>

        <Button
          variant="primary"
          size="md"
          onClick={handleConfirm}
          isLoading={isConnecting}
          icon={!isConnecting ? <Monitor className="w-4 h-4" /> : undefined}
        >
          {isConnecting ? 'Запуск...' : 'Выбрать экран'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
});

ScreenShareModal.displayName = 'ScreenShareModal';
