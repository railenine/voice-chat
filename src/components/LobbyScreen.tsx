import React from 'react';

interface LobbyScreenProps {
  nickname: string;
  mode: 'create' | 'join';
  setMode: (mode: 'create' | 'join') => void;
  joinRoomId: string;
  setJoinRoomId: (id: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  nickname,
  mode,
  setMode,
  joinRoomId,
  setJoinRoomId,
  onCreateRoom,
  onJoinRoom,
}) => {
  return (
    <>
      {/* Jelly Background */}
      <div className="jelly-background">
        <div className="jelly-blob jelly-blob-1"></div>
        <div className="jelly-blob jelly-blob-2"></div>
        <div className="jelly-blob jelly-blob-3"></div>
        <div className="jelly-blob jelly-blob-4"></div>
      </div>

      {/* Content */}
      <div className="content-wrapper min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full">
          {/* Logo / Title */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r from-blue-700 to-blue-900 mb-4 shadow-lg shadow-blue-900/50">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">VoiceChat</h1>
            <p className="text-gray-400 text-sm sm:text-base">Голосовой чат в браузере</p>
          </div>

          {/* Nickname Card */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-5 sm:p-6 mb-5 sm:mb-6 border border-white/10 animate-bounce-in">
            <div className="text-center">
              <p className="text-gray-400 text-xs sm:text-sm mb-2">Ваш никнейм</p>
              <p className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                {nickname}
              </p>
              <button
                onClick={() => {
                  const newNick = `${['Быстрый', 'Тихий', 'Мудрый', 'Смелый', 'Весёлый', 'Добрый', 'Храбрый', 'Ловкий', 'Грозный', 'Спокойный', 'Яркий', 'Тёмный', 'Золотой', 'Серебряный', 'Огненный'][Math.floor(Math.random() * 15)]}${['Волк', 'Тигр', 'Орёл', 'Дракон', 'Феникс', 'Лев', 'Медведь', 'Ястреб', 'Пантера', 'Лис', 'Кот', 'Пёс', 'Сова', 'Дельфин', 'Кит'][Math.floor(Math.random() * 15)]}${Math.floor(Math.random() * 100)}`;
                  sessionStorage.setItem('voicechat-nickname', newNick);
                  window.location.reload();
                }}
                className="mt-2 text-xs text-gray-500 hover:text-blue-400 transition-colors"
              >
                🔄 Сменить никнейм
              </button>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-5 sm:p-6 border border-white/10 animate-slide-up">
            <div className="flex gap-2 mb-5 sm:mb-6">
              <button
                onClick={() => setMode('create')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all text-sm sm:text-base ${
                  mode === 'create'
                    ? 'bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg shadow-blue-900/50'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Создать
              </button>
              <button
                onClick={() => setMode('join')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all text-sm sm:text-base ${
                  mode === 'join'
                    ? 'bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg shadow-blue-900/50'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Войти
              </button>
            </div>

            {mode === 'create' ? (
              <div className="text-center">
                <p className="text-gray-300 mb-4 text-sm sm:text-base">
                  Создайте новую комнату и поделитесь ID с друзьями
                </p>
                <button
                  onClick={onCreateRoom}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-700 to-blue-900 text-white font-bold rounded-xl hover:from-blue-800 hover:to-blue-950 transition-all shadow-lg shadow-blue-900/50 hover:shadow-blue-900/70 active:scale-95"
                >
                  🎤 Создать комнату
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-300 mb-4 text-center text-sm sm:text-base">
                  Введите ID комнаты для присоединения
                </p>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  placeholder="ID КОМНАТЫ"
                  className="w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-white text-center text-base sm:text-lg font-mono tracking-widest placeholder:text-gray-600 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 mb-4"
                  maxLength={6}
                />
                <button
                  onClick={onJoinRoom}
                  disabled={joinRoomId.length < 3}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-700 to-blue-900 text-white font-bold rounded-xl hover:from-blue-800 hover:to-blue-950 transition-all shadow-lg shadow-blue-900/50 hover:shadow-blue-900/70 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔗 Присоединиться
                </button>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-5 sm:mt-6 text-center">
            <p className="text-gray-500 text-xs sm:text-sm">
              🔒 Peer-to-peer шифрование • Без записи разговоров
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
