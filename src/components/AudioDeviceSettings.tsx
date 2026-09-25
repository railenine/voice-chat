import React, { memo } from 'react';
import { Mic, Volume2, Play, Square } from 'lucide-react';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { Tooltip } from './Tooltip';

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
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <label className="text-gray-300 font-medium flex items-center gap-1.5 text-xs">
            <Mic className="w-3.5 h-3.5 text-blue-400" />
            <span>Микрофон</span>
          </label>
          {!hasPermission && (
            <button
              type="button"
              onClick={requestPermission}
              className="text-[11px] text-blue-400 hover:text-blue-300 underline"
            >
              Разрешить доступ
            </button>
          )}
        </div>

        <select
          value={selectedInput}
          onChange={(e) => setSelectedInput(e.target.value)}
          className={`w-full bg-black/30 hover:bg-black/40 focus:bg-black/50 border border-white/10 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-white text-xs focus:outline-none cursor-pointer transition-all ${
            compact ? 'py-1.5 px-2.5 text-xs' : 'py-2.5 px-3 text-xs sm:text-sm'
          }`}
        >
          {audioInputs.length === 0 ? (
            <option value="" className="bg-slate-900 text-white">
              Микрофон по умолчанию
            </option>
          ) : (
            audioInputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white">
                {device.label || `Микрофон (${device.deviceId.slice(0, 8)}...)`}
              </option>
            ))
          )}
        </select>

        {/* Mic test button & volume bar */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={toggleMicTest}
            className={`rounded-lg text-[11px] font-medium transition-all flex-shrink-0 active:scale-95 ${
              compact ? 'px-2.5 py-1' : 'px-3 py-1.5'
            } ${
              isTestingMic
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-white/[0.06] hover:bg-white/[0.12] text-gray-200 border border-white/10'
            }`}
          >
            {isTestingMic ? (
              <span className="flex items-center gap-1.5">
                <Square className="w-3 h-3 fill-current" />
                <span>Стоп тест</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Mic className="w-3 h-3" />
                <span>Тест микрофона</span>
              </span>
            )}
          </button>

          {isTestingMic && (
            <div className="flex-1 bg-black/40 h-2.5 rounded-full overflow-hidden border border-white/10 p-0.5 animate-fade-in">
              <div
                className="h-full bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Speaker / Output Selection */}
      <div className="space-y-1 pt-0.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <label className="text-gray-300 font-medium flex items-center gap-1.5 text-xs">
            <Volume2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Динамики / Наушники</span>
          </label>
          <Tooltip content="Проверить динамики" description="Воспроизвести проверочный сигнал" position="top">
            <button
              type="button"
              onClick={playTestSound}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Проверить звук</span>
            </button>
          </Tooltip>
        </div>

        {isSinkSupported ? (
          <select
            value={selectedOutput}
            onChange={(e) => setSelectedOutput(e.target.value)}
            className={`w-full bg-black/30 hover:bg-black/40 focus:bg-black/50 border border-white/10 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-white text-xs focus:outline-none cursor-pointer transition-all ${
              compact ? 'py-1.5 px-2.5 text-xs' : 'py-2.5 px-3 text-xs sm:text-sm'
            }`}
          >
            {audioOutputs.length === 0 ? (
              <option value="" className="bg-slate-900 text-white">
                Устройство вывода по умолчанию
              </option>
            ) : (
              audioOutputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white">
                  {device.label || `Динамики (${device.deviceId.slice(0, 8)}...)`}
                </option>
              ))
            )}
          </select>
        ) : (
          <p className="text-[11px] text-gray-400 py-0.5">
            Вывод звука управляется системными настройками Windows / браузера.
          </p>
        )}
      </div>
    </div>
  );
});

AudioDeviceSettings.displayName = 'AudioDeviceSettings';
