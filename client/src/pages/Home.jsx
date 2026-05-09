import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { Users, Play, Link, List } from 'lucide-react';

export default function Home() {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [mode, setMode] = useState('create'); // create or join
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreate = () => {
    if (!name.trim()) {
      setError('Введите ваше имя');
      return;
    }
    setLoading(true);
    setError('');

    socket.emit('create-room', { name: name.trim(), roomName: roomName.trim() || 'Моя комната' });

    socket.once('room-created', ({ roomId, room }) => {
      setLoading(false);
      navigate(`/room/${roomId}`, { state: { room, isCreator: true } });
    });

    socket.once('error', ({ message }) => {
      setLoading(false);
      setError(message);
    });
  };

  const handleJoin = () => {
    if (!name.trim()) {
      setError('Введите ваше имя');
      return;
    }
    if (!joinCode.trim()) {
      setError('Введите код комнаты');
      return;
    }
    setLoading(true);
    setError('');

    socket.emit('join-room', { roomId: joinCode.trim().toUpperCase(), name: name.trim() });

    socket.once('room-joined', ({ roomId, room, team }) => {
      setLoading(false);
      navigate(`/room/${roomId}`, { state: { room, team } });
    });

    socket.once('error', ({ message }) => {
      setLoading(false);
      setError(message);
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-6xl font-bold text-shadow mb-2 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
          ALIAS
        </h1>
        <p className="text-xl text-indigo-200">Объясни слово, не называя его!</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              mode === 'create'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <Play className="inline-block w-5 h-5 mr-2" />
            Создать
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              mode === 'join'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <Link className="inline-block w-5 h-5 mr-2" />
            Войти
          </button>
        </div>

        <button
          onClick={() => navigate('/lobbies')}
          className="w-full mb-4 py-2 rounded-xl font-semibold bg-white/10 text-white/70 hover:bg-white/20 transition-all flex items-center justify-center gap-2"
        >
          <List className="w-4 h-4" />
          Список комнат
        </button>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-indigo-200 mb-2">Ваше имя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите имя..."
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
              maxLength={20}
            />
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-sm text-indigo-200 mb-2">Название комнаты (опционально)</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Название комнаты..."
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                maxLength={30}
              />
            </div>
          )}

          {mode === 'join' && (
            <div>
              <label className="block text-sm text-indigo-200 mb-2">Код комнаты</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/20 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <span className="inline-flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Загрузка...
              </span>
            ) : mode === 'create' ? (
              <>
                <Users className="inline-block w-5 h-5 mr-2" />
                Создать комнату
              </>
            ) : (
              <>
                <Play className="inline-block w-5 h-5 mr-2" />
                Присоединиться
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-8 text-center text-indigo-300 text-sm max-w-md">
        <p>🎮 Создайте комнату и поделитесь кодом с друзьями</p>
        <p>👥 Разделитесь на 2 команды</p>
        <p>🎯 Объясняйте слова и набирайте очки!</p>
      </div>
    </div>
  );
}
