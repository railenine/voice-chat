import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  generateRoomId,
  extractRoomId,
  getStoredNickname,
  saveStoredNickname,
} from './utils/nicknames';
import { addRecentRoom } from './utils/recentRoomsPolicy';
import { LobbyScreen } from './components/LobbyScreen';
import { TitleBar } from './components/TitleBar';
import { ChunkErrorBoundary, RoomLoadingFallback } from './components/ChunkErrorBoundary';
import { useAudioDevices } from './hooks/useAudioDevices';
import { useAppUpdater } from './hooks/useAppUpdater';
import { isTauri } from './config';

const VoiceChatScreen = lazy(() =>
  import('./components/VoiceChatScreen').then((m) => ({ default: m.VoiceChatScreen }))
);

const UpdateModal = lazy(() =>
  import('./components/UpdateModal').then((m) => ({ default: m.UpdateModal }))
);

function App() {
  const [nickname, setNickname] = useState<string>(() => getStoredNickname());
  const [roomId, setRoomId] = useState<string>('');
  const [joined, setJoined] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [joinRoomId, setJoinRoomId] = useState('');

  const handleSetNickname = useCallback((newNick: string) => {
    setNickname(newNick);
    saveStoredNickname(newNick);
  }, []);

  const {
    status: updateStatus,
    updateInfo,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    error: updateError,
    isModalOpen: isUpdateModalOpen,
    isPortable,
    checkForUpdates,
    installUpdate,
    dismissModal,
    hasAvailableUpdate,
  } = useAppUpdater({ isInRoom: joined });

  const handleCheckUpdates = useCallback(() => {
    checkForUpdates(true);
  }, [checkForUpdates]);

  const handleCloseUpdateModal = useCallback(() => {
    dismissModal();
  }, [dismissModal]);

  useEffect(() => {
    // Check URL for room ID
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom) {
        const clean = extractRoomId(urlRoom);
        setRoomId(clean);
        setMode('join');
        setJoinRoomId(clean);
      }
    } catch {}
  }, []);

  // Reveal app interface and fade out splash preloader once React mounts
  useEffect(() => {
    const preloader = document.getElementById('app-preloader');
    const root = document.getElementById('root');
    const hint = document.getElementById('app-preloader-hint');

    const searchParams = new URLSearchParams(window.location.search);
    const isHoldPreview =
      searchParams.has('preloader') ||
      searchParams.has('preview-loader') ||
      searchParams.has('debug-preloader');

    // Expose helper to inspect preloader in console or tests
    (window as unknown as { __showPreloader: (hold?: boolean) => void }).__showPreloader = (hold = true) => {
      if (!preloader) return;
      preloader.classList.remove('fade-out');
      preloader.style.display = 'flex';
      if (hint && hold) hint.style.display = 'block';
    };

    if (isHoldPreview) {
      if (hint) hint.style.display = 'block';
      const dismiss = () => {
        if (root) root.classList.add('app-loaded');
        if (preloader) {
          preloader.classList.add('fade-out');
          setTimeout(() => {
            preloader.style.display = 'none';
          }, 400);
        }
        window.removeEventListener('click', dismiss);
        window.removeEventListener('keydown', dismiss);
      };
      window.addEventListener('click', dismiss);
      window.addEventListener('keydown', dismiss);
      return;
    }

    // Instant startup: reveal UI immediately upon first frame paint without artificial delays
    const frameId = requestAnimationFrame(() => {
      if (root) {
        root.classList.add('app-loaded');
      }

      if (preloader) {
        preloader.classList.add('fade-out');
        const removeTimer = setTimeout(() => {
          preloader.style.display = 'none';
        }, 350);
        return () => clearTimeout(removeTimer);
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, []);

  // In desktop app, disable default browser context menu to prevent crashes/freezes from WebView2 options
  useEffect(() => {
    if (!isTauri()) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, []);

  // Prime audio playback across all platforms (PC Web, Desktop Tauri, Android, iOS Safari)
  // Ensures audio permissions are captured synchronously within the user click gesture before getUserMedia prompt
  const primeAudioEngine = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctx.resume().catch(() => {});
      }
      const audio = document.createElement('audio');
      audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      (audio as any).playsInline = true;
      (audio as any).webkitPlaysInline = true;
      audio.volume = 0.01;
      const p = audio.play();
      if (p) {
        p.then(() => {
          audio.pause();
          audio.remove();
        }).catch(() => {});
      }
    } catch {}
  }, []);

  const handleCreateRoom = useCallback(() => {
    primeAudioEngine();
    const newRoomId = generateRoomId();
    addRecentRoom(newRoomId);
    setRoomId(newRoomId);
    setJoined(true);
    window.history.replaceState({}, '', `?room=${newRoomId}`);
  }, [primeAudioEngine]);

  const handleJoinRoom = useCallback((targetRoomId?: string) => {
    primeAudioEngine();
    const cleanId = extractRoomId(targetRoomId || joinRoomId);
    if (cleanId.length >= 3) {
      addRecentRoom(cleanId);
      setRoomId(cleanId);
      setJoined(true);
      window.history.replaceState({}, '', `?room=${cleanId}`);
    }
  }, [joinRoomId, primeAudioEngine]);

  const handleLeaveRoom = useCallback(() => {
    setJoined(false);
    setMode('join');
    setJoinRoomId(roomId);
    window.history.replaceState({}, '', window.location.pathname);
    const savedNick = getStoredNickname();
    if (savedNick) {
      setNickname(savedNick);
    }
  }, [roomId]);

  const audioDevices = useAudioDevices();

  // Prevent mobile window-level scrolling quirks
  useEffect(() => {
    const resetScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener('resize', resetScroll);
    window.addEventListener('orientationchange', resetScroll);
    window.addEventListener('scroll', resetScroll);
    return () => {
      window.removeEventListener('resize', resetScroll);
      window.removeEventListener('orientationchange', resetScroll);
      window.removeEventListener('scroll', resetScroll);
    };
  }, []);

  // Preload VoiceChatScreen chunk during idle time while user is in Lobby
  useEffect(() => {
    if (!joined) {
      const prefetch = () => {
        import('./components/VoiceChatScreen');
      };
      if ('requestIdleCallback' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handle = (window as any).requestIdleCallback(prefetch, { timeout: 3000 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return () => (window as any).cancelIdleCallback?.(handle);
      } else {
        const timer = setTimeout(prefetch, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [joined]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-transparent select-none relative z-10">
      {isTauri() && (
        <TitleBar
          roomId={joined ? roomId : undefined}
          onCheckUpdates={handleCheckUpdates}
          hasUpdate={hasAvailableUpdate}
          updateVersion={updateInfo?.version}
        />
      )}
      <div className="flex-1 min-h-0 w-full relative flex flex-col overflow-hidden">
        {!joined ? (
          <LobbyScreen
            nickname={nickname}
            setNickname={handleSetNickname}
            mode={mode}
            setMode={setMode}
            joinRoomId={joinRoomId}
            setJoinRoomId={setJoinRoomId}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            deviceState={audioDevices}
            onCheckUpdates={handleCheckUpdates}
          />
        ) : (
          <ChunkErrorBoundary fallbackText="Не удалось загрузить модуль комнаты">
            <Suspense fallback={<RoomLoadingFallback />}>
              <VoiceChatScreen
                nickname={nickname}
                roomId={roomId}
                deviceState={audioDevices}
                onLeave={handleLeaveRoom}
                onCheckUpdates={handleCheckUpdates}
                hasUpdate={hasAvailableUpdate}
                updateVersion={updateInfo?.version}
              />
            </Suspense>
          </ChunkErrorBoundary>
        )}
      </div>

      {/* Global Update Modal (Web & Tauri Desktop) */}
      {isUpdateModalOpen && (
        <ChunkErrorBoundary fallbackText="Не удалось загрузить модуль обновления">
          <Suspense fallback={null}>
            <UpdateModal
              isOpen={isUpdateModalOpen}
              onClose={handleCloseUpdateModal}
              status={updateStatus}
              updateInfo={updateInfo}
              downloadProgress={downloadProgress}
              downloadedBytes={downloadedBytes}
              totalBytes={totalBytes}
              error={updateError}
              isPortable={isPortable}
              isInRoom={joined}
              onInstall={installUpdate}
              onCheckAgain={handleCheckUpdates}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}
    </div>
  );
}

export default App;
