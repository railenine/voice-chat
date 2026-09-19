import { useState, useEffect, useCallback } from 'react';
import { generateNickname, generateRoomId } from './utils/nicknames';
import { LobbyScreen } from './components/LobbyScreen';
import { VoiceChatScreen } from './components/VoiceChatScreen';

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
        setRoomId(urlRoom);
        setMode('join');
        setJoinRoomId(urlRoom);
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
    if (joinRoomId.trim().length > 0) {
      setRoomId(joinRoomId.trim().toUpperCase());
      setJoined(true);
      window.history.replaceState({}, '', `?room=${joinRoomId.trim().toUpperCase()}`);
    }
  }, [joinRoomId]);

  if (!joined) {
    return (
      <LobbyScreen
        nickname={nickname}
        setNickname={setNickname}
        mode={mode}
        setMode={setMode}
        joinRoomId={joinRoomId}
        setJoinRoomId={setJoinRoomId}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    );
  }

  return (
    <VoiceChatScreen
      nickname={nickname}
      roomId={roomId}
    />
  );
}

export default App;
