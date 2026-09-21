import React from 'react';
import { useAudioDevices } from '../hooks/useAudioDevices';

interface AudioDeviceSettingsProps {
  deviceState: ReturnType<typeof useAudioDevices>;
  compact?: boolean;
}

export const AudioDeviceSettings: React.FC<AudioDeviceSettingsProps> = ({
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
    <div className={`space-y-4 ${compact ? 'text-sm' : ''}`}>
      {/* Microphone Selection */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <label className="text-gray-300 font-medium flex items-center gap-1.5 text-xs sm:text-sm">
            <span>🎙️</span>
            <span>Микрофон</span>
          </label>
          {!hasPermission && (
            <button
              type="button"
              onClick={requestPermission}
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Разрешить доступ
            </button>
          )}
        </div>

        <select
          value={selectedInput}
          onChange={(e) => setSelectedInput(e.target.value)}
          className="w-full py-2.5 px-3 bg-white/10 border border-white/20 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
        >
          {audioInputs.length === 0 ? (
            <option value="" className="bg-gray-800 text-white">
              Микрофон по умолчанию
            </option>
          ) : (
            audioInputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId} className="bg-gray-800 text-white">
                {device.label || `Микрофон (${device.deviceId.slice(0, 8)}...)`}
              </option>
            ))
          )}
        </select>

        {/* Mic test button & volume bar */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={toggleMicTest}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
              isTestingMic
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-white/10 text-gray-300 border border-white/10 hover:bg-white/20'
            }`}
          >
            {isTestingMic ? '⏹ Остановить тест' : '🎤 Тест микрофона'}
          </button>

          {isTestingMic && (
            <div className="flex-1 bg-black/40 h-3 rounded-full overflow-hidden border border-white/10 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Speaker / Output Selection */}
      <div className="space-y-1.5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <label className="text-gray-300 font-medium flex items-center gap-1.5 text-xs sm:text-sm">
            <span>🔊</span>
            <span>Динамики / Наушники</span>
          </label>
          <button
            type="button"
            onClick={playTestSound}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            title="Воспроизвести проверочный сигнал"
          >
            ▶ Проверить звук
          </button>
        </div>

        {isSinkSupported ? (
          <select
            value={selectedOutput}
            onChange={(e) => setSelectedOutput(e.target.value)}
            className="w-full py-2.5 px-3 bg-white/10 border border-white/20 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            {audioOutputs.length === 0 ? (
              <option value="" className="bg-gray-800 text-white">
                Устройство вывода по умолчанию
              </option>
            ) : (
              audioOutputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId} className="bg-gray-800 text-white">
                  {device.label || `Динамики (${device.deviceId.slice(0, 8)}...)`}
                </option>
              ))
            )}
          </select>
        ) : (
          <p className="text-xs text-gray-400 py-1">
            Вывод звука управляется системными настройками Windows / браузера.
          </p>
        )}
      </div>
    </div>
  );
};
