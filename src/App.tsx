import { useState, useEffect, useCallback } from 'react';
import { generateNickname, generateRoomId, extractRoomId } from './utils/nicknames';
import { LobbyScreen } from './components/LobbyScreen';
import { VoiceChatScreen } from './components/VoiceChatScreen';
import { TitleBar } from './components/TitleBar';
import { UpdateModal } from './components/UpdateModal';
import { useAudioDevices } from './hooks/useAudioDevices';
import { useAppUpdater } from './hooks/useAppUpdater';
import { isTauri } from './config';

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, val: string): void => {
    try {
      sessionStorage.setItem(key, val);
    } catch {}
  },
};

function App() {
  const [nickname, setNickname] = useState<string>(() => {
    const saved = safeStorage.getItem('voicechat-nickname');
    if (saved) return saved;
    const newNick = generateNickname();
    safeStorage.setItem('voicechat-nickname', newNick);
    return newNick;
  });
  const [roomId, setRoomId] = useState<string>('');
  const [joined, setJoined] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [joinRoomId, setJoinRoomId] = useState('');

  const {
    status: updateStatus,
    updateInfo,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    error: updateError,
    isModalOpen: isUpdateModalOpen,
    setIsModalOpen: setIsUpdateModalOpen,
    isPortable,
    checkForUpdates,
    installUpdate,
  } = useAppUpdater();

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

  // Gracefully disperse jelly blobs, reveal app interface, and fade out splash preloader once React mounts
  useEffect(() => {
    const jellyBg = document.getElementById('jelly-bg');
    const preloader = document.getElementById('app-preloader');
    const root = document.getElementById('root');

    // Settle frame so React DOM is completely painted before reveal
    const frameId = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        // 1. Reveal loaded app UI seamlessly
        if (root) {
          root.classList.add('app-loaded');
        }

        // 2. Disperse jelly blobs outward from center to corners
        if (jellyBg) {
          jellyBg.classList.remove('jelly-converged');
          jellyBg.classList.add('jelly-dispersed');
        }

        // 3. Fade out splash preloader icon and dots simultaneously
        if (preloader) {
          preloader.classList.add('fade-out');
          const removeTimer = setTimeout(() => {
            preloader.remove();
          }, 400);
          return () => clearTimeout(removeTimer);
        }
      }, 100);

      return () => clearTimeout(timer);
    });

    return () => cancelAnimationFrame(frameId);
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
    setRoomId(newRoomId);
    setJoined(true);
    window.history.replaceState({}, '', `?room=${newRoomId}`);
  }, [primeAudioEngine]);

  const handleJoinRoom = useCallback(() => {
    primeAudioEngine();
    const cleanId = extractRoomId(joinRoomId);
    if (cleanId.length >= 3) {
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

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-transparent select-none relative z-10">
      {isTauri() && (
        <TitleBar
          roomId={joined ? roomId : undefined}
          onCheckUpdates={() => checkForUpdates(true)}
        />
      )}
      <div className="flex-1 min-h-0 w-full relative flex flex-col overflow-hidden">
        {!joined ? (
          <LobbyScreen
            nickname={nickname}
            setNickname={setNickname}
            mode={mode}
            setMode={setMode}
            joinRoomId={joinRoomId}
            setJoinRoomId={setJoinRoomId}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            deviceState={audioDevices}
            onCheckUpdates={() => checkForUpdates(true)}
          />
        ) : (
          <VoiceChatScreen
            nickname={nickname}
            roomId={roomId}
            deviceState={audioDevices}
            onLeave={handleLeaveRoom}
          />
        )}
      </div>

      {/* Global Update Modal (Web & Tauri Desktop) */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        status={updateStatus}
        updateInfo={updateInfo}
        downloadProgress={downloadProgress}
        downloadedBytes={downloadedBytes}
        totalBytes={totalBytes}
        error={updateError}
        isPortable={isPortable}
        onInstall={installUpdate}
        onCheckAgain={() => checkForUpdates(true)}
      />
    </div>
  );
}

export default App;
