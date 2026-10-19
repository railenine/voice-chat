import React, { memo, useMemo } from 'react';
import { Mic, Volume2, Play, Square } from 'lucide-react';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { Tooltip } from './Tooltip';
import { Button, Select, SelectOption } from './ui';

interface AudioDeviceSettingsProps {
  deviceState: ReturnType<typeof useAudioDevices>;
  compact?: boolean;
}

export const AudioDeviceSettings: React.FC<AudioDeviceSettingsProps> = memo(({
  deviceState,
  compact = false,
}) => {
  const {
    audioInputs,
    audioOutputs,
    selectedInput,
    selectedOutput,
    hasPermission,
    isSinkSupported,
    isTestingMic,
    micVolume,
    setSelectedInput,
    setSelectedOutput,
    requestPermission,
    toggleMicTest,
    playTestSound,
  } = deviceState;

  const inputOptions: SelectOption[] = useMemo(() => {
    if (audioInputs.length === 0) {
      return [{ value: '', label: 'Микрофон по умолчанию' }];
    }
    return audioInputs.map((device, index) => {
      const fallbackLabel =
        device.deviceId && device.deviceId !== 'default'
          ? `Микрофон ${index + 1} (${device.deviceId.slice(0, 8)}...)`
          : 'Микрофон по умолчанию';
      return {
        value: device.deviceId,
        label: device.label || fallbackLabel,
      };
    });
  }, [audioInputs]);

  const outputOptions: SelectOption[] = useMemo(() => {
    if (audioOutputs.length === 0) {
      return [{ value: '', label: 'Устройство вывода по умолчанию' }];
    }
    return audioOutputs.map((device, index) => {
      const fallbackLabel =
        device.deviceId && device.deviceId !== 'default'
          ? `Динамики ${index + 1} (${device.deviceId.slice(0, 8)}...)`
          : 'Устройство вывода по умолчанию';
      return {
        value: device.deviceId,
        label: device.label || fallbackLabel,
      };
    });
  }, [audioOutputs]);

  return (
    <div className={compact ? 'space-y-2.5 text-xs' : 'space-y-4 text-sm'}>
      {/* Microphone Selection */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <label className="text-[var(--fg)] font-medium flex items-center gap-1.5 text-xs">
            <Mic className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Микрофон</span>
          </label>
          {!hasPermission && (
            <button
              type="button"
              onClick={requestPermission}
              className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
            >
              Разрешить доступ
            </button>
          )}
        </div>

        <Select
          value={selectedInput}
          onChange={setSelectedInput}
          options={inputOptions}
          compact={compact}
        />

        {/* Mic test button & volume bar */}
        <div className="flex items-center gap-2 pt-0.5">
          <Button
            variant={isTestingMic ? 'danger' : 'secondary'}
            size="sm"
            onClick={toggleMicTest}
            icon={isTestingMic ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3 h-3" />}
            className="text-[11px] h-7 px-2.5 rounded-[var(--radius)] shrink-0 font-medium"
          >
            {isTestingMic ? 'Стоп тест' : 'Тест микрофона'}
          </Button>

          {isTestingMic && (
            <div className="flex-1 bg-[var(--surface)] h-2 rounded-full overflow-hidden border border-[var(--border)] p-0.5 animate-fade-in">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Speaker / Output Selection */}
      <div className="space-y-1.5 pt-0.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <label className="text-[var(--fg)] font-medium flex items-center gap-1.5 text-xs">
            <Volume2 className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Динамики / Наушники</span>
          </label>
          <Tooltip content="Проверить динамики" description="Воспроизвести проверочный сигнал" position="top">
            <button
              type="button"
              onClick={playTestSound}
              className="text-[11px] text-[var(--accent)] hover:text-[var(--fg)] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Проверить звук</span>
            </button>
          </Tooltip>
        </div>

        {isSinkSupported ? (
          <Select
            value={selectedOutput}
            onChange={setSelectedOutput}
            options={outputOptions}
            compact={compact}
          />
        ) : (
          <p className="text-[11px] text-[var(--muted)] py-0.5">
            Вывод звука управляется системными настройками Windows / браузера.
          </p>
        )}
      </div>
    </div>
  );
});

AudioDeviceSettings.displayName = 'AudioDeviceSettings';


