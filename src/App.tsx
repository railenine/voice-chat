import { useState, useEffect, useCallback } from 'react';
import { generateNickname, generateRoomId } from './utils/nicknames';
import { useVoiceChat } from './hooks/useVoiceChat';
import { LobbyScreen } from './components/LobbyScreen';
import { VoiceChatScreen } from './components/VoiceChatScreen';

function App() {
  const [nickname, setNickname] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [joined, setJoined] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [joinRoomId, setJoinRoomId] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('voicechat-nickname');
    if (saved) {
      setNickname(saved);
    } else {
      const newNick = generateNickname();
      setNickname(newNick);
      sessionStorage.setItem('voicechat-nickname', newNick);
    }

    // Check URL for room ID
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) {
      setRoomId(urlRoom);
      setMode('join');
      setJoinRoomId(urlRoom);
    }
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
