import React, { memo } from 'react';
import { Mic, Volume2, Play, Square, ChevronDown } from 'lucide-react';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { Tooltip } from './Tooltip';
import { Button } from './ui';

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

        <div className="relative">
          <select
            value={selectedInput}
            onChange={(e) => setSelectedInput(e.target.value)}
            className={`w-full appearance-none bg-[var(--surface)] hover:bg-[var(--elevated)] focus:bg-[var(--elevated)] border border-[var(--border)] focus:border-[var(--accent)] rounded-[var(--radius)] text-[var(--fg)] text-xs focus:outline-none cursor-pointer transition-colors pr-8 ${
              compact ? 'py-1.5 px-2.5' : 'py-2 px-3'
            }`}
          >
            {audioInputs.length === 0 ? (
              <option value="" className="bg-[var(--surface)] text-[var(--fg)]">
                Микрофон по умолчанию
              </option>
            ) : (
              audioInputs.map((device, index) => {
                const fallbackLabel =
                  device.deviceId && device.deviceId !== 'default'
                    ? `Микрофон ${index + 1} (${device.deviceId.slice(0, 8)}...)`
                    : 'Микрофон по умолчанию';
                return (
                  <option
                    key={device.deviceId || `input-${index}`}
                    value={device.deviceId}
                    className="bg-[var(--surface)] text-[var(--fg)]"
                  >
                    {device.label || fallbackLabel}
                  </option>
                );
              })
            )}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
        </div>

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
          <div className="relative">
            <select
              value={selectedOutput}
              onChange={(e) => setSelectedOutput(e.target.value)}
              className={`w-full appearance-none bg-[var(--surface)] hover:bg-[var(--elevated)] focus:bg-[var(--elevated)] border border-[var(--border)] focus:border-[var(--accent)] rounded-[var(--radius)] text-[var(--fg)] text-xs focus:outline-none cursor-pointer transition-colors pr-8 ${
                compact ? 'py-1.5 px-2.5' : 'py-2 px-3'
              }`}
            >
              {audioOutputs.length === 0 ? (
                <option value="" className="bg-[var(--surface)] text-[var(--fg)]">
                  Устройство вывода по умолчанию
                </option>
              ) : (
                audioOutputs.map((device, index) => {
                  const fallbackLabel =
                    device.deviceId && device.deviceId !== 'default'
                      ? `Динамики ${index + 1} (${device.deviceId.slice(0, 8)}...)`
                      : 'Устройство вывода по умолчанию';
                  return (
                    <option
                      key={device.deviceId || `output-${index}`}
                      value={device.deviceId}
                      className="bg-[var(--surface)] text-[var(--fg)]"
                    >
                      {device.label || fallbackLabel}
                    </option>
                  );
                })
              )}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
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

