import React, { memo } from 'react';
import { Mic, MicOff, Headphones, VolumeX, Sparkles, ScreenShare, ScreenShareOff, PhoneOff } from 'lucide-react';
import { Tooltip } from '../Tooltip';

export interface VoiceMobileControlsProps {
  isMuted: boolean;
  isDeafened: boolean;
  isNoiseSuppression: boolean;
  canShareScreen: boolean;
  isSharingScreen: boolean;
  isConnectingScreen: boolean;
  muteHotkeyLabel: string;
  deafenHotkeyLabel: string;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleNoiseSuppression: () => void;
  onScreenShareClick: () => void;
  handleLeave: () => void;
}

export const VoiceMobileControls: React.FC<VoiceMobileControlsProps> = memo(({
  isMuted,
  isDeafened,
  isNoiseSuppression,
  canShareScreen,
  isSharingScreen,
  isConnectingScreen,
  muteHotkeyLabel,
  deafenHotkeyLabel,
  toggleMute,
  toggleDeafen,
  toggleNoiseSuppression,
  onScreenShareClick,
  handleLeave,
}) => {
  return (
    <div
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.625rem)' }}
      className="lg:hidden p-2.5 sm:p-3 bg-slate-950/60 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-2.5 sm:gap-3 flex-shrink-0 z-20"
    >
      <Tooltip
        content={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        description={isMuted ? 'Включить передачу вашего голоса' : 'Отключить передачу звука'}
        hotkey={muteHotkeyLabel}
        position="top"
      >
        <button
          onClick={toggleMute}
          className={`w-11 h-11 rounded-xl border transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md ${
            isMuted
              ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 shadow-sm shadow-red-950/40'
              : 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5 text-white" />}
        </button>
      </Tooltip>

      <Tooltip
        content={isDeafened ? 'Включить звук (Deafen)' : 'Заглушить всё (Deafen)'}
        description={isDeafened ? 'Вернуть звук собеседников и включить микрофон' : 'Полностью отключить весь входящий звук и микрофон'}
        hotkey={deafenHotkeyLabel}
        position="top"
      >
        <button
          onClick={toggleDeafen}
          className={`w-11 h-11 rounded-xl border transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md ${
            isDeafened
              ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 shadow-sm shadow-red-950/40'
              : 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white'
          }`}
        >
          {isDeafened ? (
            <VolumeX className="w-5 h-5 text-red-400" />
          ) : (
            <Headphones className="w-5 h-5 text-white" />
          )}
        </button>
      </Tooltip>

      <Tooltip
        content="Шумоподавление"
        description={isNoiseSuppression ? 'AI-фильтрация шумов активна (RNNoise)' : 'Включить нейросетевую очистку шума'}
        position="top"
      >
        <button
          onClick={toggleNoiseSuppression}
          className={`w-11 h-11 rounded-xl border transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md ${
            isNoiseSuppression
              ? 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white'
              : 'bg-white/[0.04] border border-white/10 text-gray-400 hover:text-gray-200'
          }`}
        >
          <Sparkles className="w-5 h-5" />
        </button>
      </Tooltip>

      {/* Screen Share Toggle (< 1024px) */}
      {canShareScreen && (
        <Tooltip
          content={isSharingScreen ? 'Остановить показ экрана' : 'Поделиться экраном'}
          description={
            isSharingScreen
              ? 'Прекратить демонстрацию экрана'
              : 'Трансляция экрана и звука системы через LiveKit'
          }
          position="top"
        >
          <button
            type="button"
            onClick={onScreenShareClick}
            disabled={isConnectingScreen}
            className={`w-11 h-11 rounded-xl border transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md ${
              isSharingScreen
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                : 'bg-white/[0.08] hover:bg-white/[0.14] hover:border-white/25 hover:shadow-lg hover:shadow-blue-500/10 border-white/15 text-white'
            }`}
          >
            {isSharingScreen ? (
              <ScreenShareOff className="w-5 h-5 text-emerald-400" />
            ) : (
              <ScreenShare className="w-5 h-5 transition-transform duration-200 hover:scale-110" />
            )}
          </button>
        </Tooltip>
      )}

      <Tooltip
        content="Выйти из комнаты"
        description="Отключиться и вернуться на главный экран"
        position="top"
      >
        <button
          onClick={handleLeave}
          className="w-11 h-11 rounded-xl bg-red-500/10 hover:bg-red-600/30 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 transition-all active:scale-95 flex items-center justify-center flex-shrink-0 shadow-md"
        >
          <PhoneOff className="w-5 h-5 text-red-400" />
        </button>
      </Tooltip>
    </div>
  );
});

VoiceMobileControls.displayName = 'VoiceMobileControls';
