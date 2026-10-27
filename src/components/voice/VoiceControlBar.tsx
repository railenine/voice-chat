import React, { memo } from 'react';
import { Mic, MicOff, Headphones, VolumeX, Sparkles, ScreenShare, ScreenShareOff, PhoneOff } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { Button } from '../ui';

export interface VoiceControlBarProps {
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
  className?: string;
  buttonClassName?: string;
}

export const VoiceControlBar: React.FC<VoiceControlBarProps> = memo(({
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
  className = 'flex items-center gap-2',
  buttonClassName = '',
}) => {
  return (
    <div className={className}>
      {/* Mute toggle button */}
      <Tooltip
        content={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        description={isMuted ? 'Включить передачу вашего голоса' : 'Отключить передачу звука'}
        hotkey={muteHotkeyLabel}
        position="top"
      >
        <Button
          variant={isMuted ? 'danger' : 'glass'}
          size="icon"
          onClick={toggleMute}
          aria-label={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          className={buttonClassName}
        >
          {isMuted ? <MicOff className="w-5 h-5 text-(--danger)" /> : <Mic className="w-5 h-5 text-(--fg)" />}
        </Button>
      </Tooltip>

      {/* Deafen toggle button */}
      <Tooltip
        content={isDeafened ? 'Включить звук (Deafen)' : 'Заглушить всё (Deafen)'}
        description={
          isDeafened
            ? 'Вернуть звук собеседников и включить микрофон'
            : 'Полностью отключить весь входящий звук и микрофон'
        }
        hotkey={deafenHotkeyLabel}
        position="top"
      >
        <Button
          variant={isDeafened ? 'danger' : 'glass'}
          size="icon"
          onClick={toggleDeafen}
          aria-label={isDeafened ? 'Включить звук' : 'Заглушить всё'}
          className={buttonClassName}
        >
          {isDeafened ? <VolumeX className="w-5 h-5 text-(--danger)" /> : <Headphones className="w-5 h-5 text-(--fg)" />}
        </Button>
      </Tooltip>

      {/* RNNoise AI Toggle */}
      <Tooltip
        content="Шумоподавление"
        description={
          isNoiseSuppression
            ? 'AI-фильтрация шумов активна (RNNoise)'
            : 'Включить нейросетевую очистку шума'
        }
        position="top"
      >
        <Button
          variant={isNoiseSuppression ? 'accent' : 'glass'}
          size="icon"
          onClick={toggleNoiseSuppression}
          aria-label="Шумоподавление"
          className={`${!isNoiseSuppression ? 'text-(--muted)' : ''} ${buttonClassName}`.trim()}
        >
          <Sparkles className={`w-5 h-5 ${isNoiseSuppression ? 'text-(--accent)' : ''}`} />
        </Button>
      </Tooltip>

      {/* Screen Share Toggle */}
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
          <Button
            variant={isSharingScreen ? 'accent' : 'glass'}
            size="icon"
            onClick={onScreenShareClick}
            disabled={isConnectingScreen}
            aria-label={isSharingScreen ? 'Остановить показ экрана' : 'Поделиться экраном'}
            className={buttonClassName}
          >
            {isSharingScreen ? (
              <ScreenShareOff className="w-5 h-5 text-(--accent)" />
            ) : (
              <ScreenShare className="w-5 h-5 text-(--fg)" />
            )}
          </Button>
        </Tooltip>
      )}

      {/* Leave Button */}
      <Tooltip content="Выйти из комнаты" description="Отключиться и вернуться на главный экран" position="top">
        <Button
          variant="danger"
          size="icon"
          onClick={handleLeave}
          aria-label="Выйти из комнаты"
          className={buttonClassName}
        >
          <PhoneOff className="w-5 h-5 text-(--danger)" />
        </Button>
      </Tooltip>
    </div>
  );
});

VoiceControlBar.displayName = 'VoiceControlBar';
