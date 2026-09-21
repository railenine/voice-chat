import { useState, useEffect, useCallback } from 'react';
import { generateNickname, generateRoomId, extractRoomId } from './utils/nicknames';
import { LobbyScreen } from './components/LobbyScreen';
import { VoiceChatScreen } from './components/VoiceChatScreen';
import { TitleBar } from './components/TitleBar';
import { useAudioDevices } from './hooks/useAudioDevices';
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

  const handleCreateRoom = useCallback(() => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    setJoined(true);
    window.history.replaceState({}, '', `?room=${newRoomId}`);
  }, []);

  const handleJoinRoom = useCallback(() => {
    const cleanId = extractRoomId(joinRoomId);
    if (cleanId.length >= 3) {
      setRoomId(cleanId);
      setJoined(true);
      window.history.replaceState({}, '', `?room=${cleanId}`);
    }
  }, [joinRoomId]);

  const audioDevices = useAudioDevices();

  return (
    <div className="h-screen h-[100dvh] w-full flex flex-col overflow-hidden bg-slate-950 select-none">
      {isTauri() && <TitleBar roomId={joined ? roomId : undefined} />}
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
          />
        ) : (
          <VoiceChatScreen
            nickname={nickname}
            roomId={roomId}
            deviceState={audioDevices}
          />
        )}
      </div>
    </div>
  );
}

export default App;
