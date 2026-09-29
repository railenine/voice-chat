import React, { useState, useEffect, useRef, memo } from 'react';
import {
  RemoteVideoTrack,
  RemoteAudioTrack,
  LocalVideoTrack,
  LocalAudioTrack,
} from 'livekit-client';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Volume1,
  Monitor,
  ScreenShareOff,
  Radio,
  X,
} from 'lucide-react';
import { RemoteScreenShare } from '../hooks/useScreenShare';

interface ScreenShareViewProps {
  activeStreams: RemoteScreenShare[];
  localVideoTrack: LocalVideoTrack | null;
  localAudioTrack: LocalAudioTrack | null;
  isSharing: boolean;
  myNickname: string;
  watchedPeerId: string | null;
  onStopSharing: () => void;
  onCloseView: () => void;
  onSelectStream: (participantId: string) => void;
  streamVolumes: Record<string, number>;
  onVolumeChange: (participantId: string, volume: number) => void;
}

export const ScreenShareView: React.FC<ScreenShareViewProps> = memo(({
  activeStreams,
  localVideoTrack,
  localAudioTrack,
  isSharing,
  myNickname,
  watchedPeerId,
  onStopSharing,
  onCloseView,
  onSelectStream,
  streamVolumes,
  onVolumeChange,
}) => {
  const [focusedId, setFocusedId] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<any>(null);

  // Sync focused stream with watchedPeerId or local sharing state
  useEffect(() => {
    if (watchedPeerId && watchedPeerId !== 'local') {
      if (activeStreams.some((s) => s.participantId === watchedPeerId)) {
        setFocusedId(watchedPeerId);
        return;
      }
    }
    if (isSharing) {
      setFocusedId('local');
    } else if (activeStreams.length > 0) {
      setFocusedId(activeStreams[0].participantId);
    } else {
      setFocusedId('');
    }
  }, [activeStreams, isSharing, watchedPeerId]);

  // Fullscreen toggle handler with universal Mobile/iOS/Android support
  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;

    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } catch (e) {
        // Fallback to CSS fullscreen overlay (works on iOS Safari on iPhone)
        console.log('[ScreenShare] Native fullscreen not supported or denied, using CSS fullscreen fallback');
      }
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitFullscreenElement && (document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      } catch (e) {
        console.warn('Exit fullscreen error:', e);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      if (!isFs && (document.fullscreenElement !== undefined || (document as any).webkitFullscreenElement !== undefined)) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Controls auto-hide on inactivity (mouse or touch)
  const handleUserInteraction = () => {
    setIsControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      setIsControlsVisible(false);
    }, 4000);
  };

  // Only render if user is sharing their own screen OR actively watching a stream
  const isViewingStream = Boolean(
    (watchedPeerId &&
      (watchedPeerId === 'local'
        ? isSharing
        : activeStreams.some((s) => s.participantId === watchedPeerId))) ||
    isSharing
  );

  if (!isViewingStream) {
    return null;
  }

  // Find currently focused stream
  const isLocalFocused =
    focusedId === 'local' ||
    (isSharing && (!watchedPeerId || watchedPeerId === 'local'));

  const focusedRemoteStream = isLocalFocused
    ? null
    : activeStreams.find((s) => s.participantId === focusedId) ||
    (watchedPeerId ? activeStreams.find((s) => s.participantId === watchedPeerId) : null);

  const handleSelectThumbnail = (id: string) => {
    setFocusedId(id);
    onSelectStream(id);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserInteraction}
      onTouchStart={handleUserInteraction}
      onClick={handleUserInteraction}
      className={`w-full overflow-hidden flex flex-col transition-all group ${isFullscreen
          ? 'fixed inset-0 z-50 h-screen h-[100dvh] w-screen bg-black rounded-none border-none'
          : 'relative rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-2xl shadow-2xl max-h-[60vh] min-h-[280px] sm:min-h-[360px] flex-1'
        }`}
      style={
        isFullscreen
          ? {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100dvh',
            zIndex: 9999,
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }
          : undefined
      }
    >
      {/* Main Video Viewport */}
      <div className="relative flex-1 w-full h-full min-h-0 bg-black/60 flex items-center justify-center overflow-hidden">
        {isLocalFocused && localVideoTrack ? (
          <LocalVideoPlayer
            track={localVideoTrack}
            hasAudio={Boolean(localAudioTrack)}
            nickname={myNickname}
            onStopSharing={onStopSharing}
          />
        ) : focusedRemoteStream && focusedRemoteStream.videoTrack ? (
          <RemoteVideoPlayer
            stream={focusedRemoteStream}
            volume={streamVolumes[focusedRemoteStream.participantId] ?? 100}
            onVolumeChange={(vol) => onVolumeChange(focusedRemoteStream.participantId, vol)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Monitor className="w-10 h-10 animate-pulse text-blue-400" />
            <span className="text-xs">Загрузка трансляции...</span>
          </div>
        )}

        {/* Floating Top Header Overlay */}
        <div
          className={`absolute top-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between gap-3 transition-opacity duration-300 z-20 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-white font-semibold text-xs sm:text-sm truncate drop-shadow">
              {isLocalFocused ? `${myNickname} (Ваш экран)` : focusedRemoteStream?.participantName || 'Трансляция'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
              <Radio className="w-2.5 h-2.5 animate-pulse shrink-0" />
              <span>В эфире</span>
            </span>
            {((isLocalFocused && localAudioTrack) || focusedRemoteStream?.hasAudio) && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                <Volume2 className="w-3 h-3 shrink-0" />
                <span>Звук системы</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Stream volume control in top header for remote stream */}
            {!isLocalFocused && focusedRemoteStream && (
              <div className="btn-compact !min-w-0 !min-h-0 h-8 px-2 sm:px-2.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/15 flex items-center gap-1.5 text-xs text-white shrink-0 shadow-sm">
                <button
                  type="button"
                  onClick={() =>
                    onVolumeChange(
                      focusedRemoteStream.participantId,
                      (streamVolumes[focusedRemoteStream.participantId] ?? 100) === 0 ? 100 : 0
                    )
                  }
                  className="hover:text-emerald-400 transition-colors p-0.5 cursor-pointer flex items-center justify-center"
                  title="Вкл/Выкл звук стрима"
                >
                  {(streamVolumes[focusedRemoteStream.participantId] ?? 100) === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={streamVolumes[focusedRemoteStream.participantId] ?? 100}
                  onChange={(e) =>
                    onVolumeChange(focusedRemoteStream.participantId, Number(e.target.value))
                  }
                  className="w-14 sm:w-20 h-1.5 bg-white/25 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  title={`Громкость стрима: ${streamVolumes[focusedRemoteStream.participantId] ?? 100}%`}
                />
                <span className="font-mono text-[10px] text-emerald-300 font-semibold w-6 text-right">
                  {streamVolumes[focusedRemoteStream.participantId] ?? 100}%
                </span>
              </div>
            )}

            {isLocalFocused ? (
              <button
                type="button"
                onClick={onStopSharing}
                className="btn-compact !min-w-0 !min-h-0 h-8 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs font-medium transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm shrink-0 cursor-pointer"
                title="Остановить показ экрана"
              >
                <ScreenShareOff className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Остановить показ</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onCloseView}
                className="btn-compact !min-w-0 !min-h-0 h-8 px-2 sm:px-2.5 rounded-lg bg-white/10 hover:bg-rose-500/20 border border-white/15 hover:border-rose-500/40 text-gray-300 hover:text-rose-200 text-xs font-medium transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm shrink-0 cursor-pointer"
                title="Закрыть окно просмотра"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Закрыть просмотр</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn-compact !min-w-0 !min-h-0 w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 border border-white/15 hover:border-white/30 text-white transition-all active:scale-95 shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
              title={isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 shrink-0 block" />
              ) : (
                <Maximize2 className="w-4 h-4 shrink-0 block" />
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Multi-stream Thumbnails Bar (visible if 2 or more streams are active) */}
      {(activeStreams.length > 1 || (isSharing && activeStreams.length > 0)) && (
        <div className="px-3 py-2 border-t border-white/10 bg-slate-950/90 backdrop-blur-xl flex items-center gap-2 overflow-x-auto no-scrollbar z-10 flex-shrink-0">
          <span className="text-[11px] text-gray-400 flex items-center gap-1 flex-shrink-0 mr-1">
            <Radio className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            Стримы ({activeStreams.length + (isSharing ? 1 : 0)}):
          </span>
          {/* Local thumbnail if sharing */}
          {isSharing && (
            <button
              type="button"
              onClick={() => handleSelectThumbnail('local')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 flex-shrink-0 active:scale-95 cursor-pointer ${focusedId === 'local'
                  ? 'bg-blue-600/30 border-blue-500/60 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-black/30 border-white/10 text-gray-300 hover:bg-black/50'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Вы (Экран)</span>
            </button>
          )}
          {/* Remote thumbnails */}
          {activeStreams.map((stream) => (
            <button
              key={stream.participantId}
              type="button"
              onClick={() => handleSelectThumbnail(stream.participantId)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 flex-shrink-0 active:scale-95 cursor-pointer ${focusedId === stream.participantId
                  ? 'bg-blue-600/30 border-blue-500/60 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-black/30 border-white/10 text-gray-300 hover:bg-black/50'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate max-w-[120px]">{stream.participantName}</span>
              {stream.hasAudio && <Volume2 className="w-3 h-3 text-blue-300 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// Component to render Remote Video + System Audio
interface RemoteVideoPlayerProps {
  stream: RemoteScreenShare;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

const RemoteVideoPlayer: React.FC<RemoteVideoPlayerProps> = ({
  stream,
  volume,
  onVolumeChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Attach Remote Video Track
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream.videoTrack) return;

    stream.videoTrack.attach(videoEl);
    videoEl.play().catch(() => { });
    return () => {
      stream.videoTrack?.detach(videoEl);
    };
  }, [stream.videoTrack]);

  // Attach Remote Audio Track (System Audio)
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !stream.audioTrack) return;

    stream.audioTrack.attach(audioEl);
    stream.audioTrack.setVolume(volume / 100);
    audioEl.play().catch(() => { });

    return () => {
      stream.audioTrack?.detach(audioEl);
    };
  }, [stream.audioTrack]);

  // Update volume when slider moves
  useEffect(() => {
    if (stream.audioTrack) {
      stream.audioTrack.setVolume(volume / 100);
    }
  }, [volume, stream.audioTrack]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        webkit-playsinline="true"
        className="w-full h-full object-contain max-h-full"
        style={{ imageRendering: 'auto' }}
      />
      {stream.audioTrack && <audio ref={audioRef} autoPlay playsInline />}
    </div>
  );
};

// Component to render Local Screen Preview
interface LocalVideoPlayerProps {
  track: LocalVideoTrack;
  hasAudio: boolean;
  nickname: string;
  onStopSharing: () => void;
}

const LocalVideoPlayer: React.FC<LocalVideoPlayerProps> = ({
  track,
  hasAudio,
  nickname,
  onStopSharing,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !track) return;

    track.attach(videoEl);
    videoEl.play().catch(() => { });
    return () => {
      track.detach(videoEl);
    };
  }, [track]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        webkit-playsinline="true"
        muted // Always mute local screen preview to prevent echo loops
        className="w-full h-full object-contain max-h-full"
        style={{ imageRendering: 'auto' }}
      />
      {/* Notice Banner */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-slate-950/80 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-xl shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="text-xs text-gray-200">Вы транслируете экран</span>
        {hasAudio && (
          <span className="text-[10px] text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30 shrink-0">
            Звук включен
          </span>
        )}
      </div>
    </div>
  );
};
