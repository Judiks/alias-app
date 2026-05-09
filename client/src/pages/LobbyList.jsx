import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { Users, Play, RefreshCw, ArrowLeft } from 'lucide-react';

export default function LobbyList() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinName, setJoinName] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);

  const fetchRooms = () => {
    setLoading(true);
    socket.emit('get-rooms');
  };

  useEffect(() => {
    // Request rooms list via socket
    socket.emit('get-rooms');

    socket.on('rooms-list', ({ rooms: roomList }) => {
      setRooms(roomList || []);
      setLoading(false);
    });

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      socket.emit('get-rooms');
    }, 5000);

    // Timeout fallback
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      socket.off('rooms-list');
    };
  }, []);

  const handleJoinRoom = (roomId) => {
    if (!joinName.trim()) {
      alert('Введите имя');
      return;
    }
    localStorage.setItem('alias_player_name', joinName.trim());
    navigate(`/room/${roomId}`, { state: { team: null, isCreator: false } });
  };

  const handleQuickJoin = (roomId) => {
    const savedName = localStorage.getItem('alias_player_name');
    if (savedName) {
      setJoinName(savedName);
    }
    setJoinRoomId(roomId);
    setShowJoinForm(true);
  };

  const getStateLabel = (state) => {
    switch (state) {
      case 'lobby': return 'Лобби';
      case 'playing': return 'Игра';
      case 'break': return 'Перерыв';
      case 'finished': return 'Завершена';
      default: return state;
    }
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'lobby': return 'bg-green-500/20 text-green-300';
      case 'playing': return 'bg-blue-500/20 text-blue-300';
      case 'break': return 'bg-yellow-500/20 text-yellow-300';
      case 'finished': return 'bg-gray-500/20 text-gray-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Активные комнаты</h1>
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        </div>

        <button
          onClick={fetchRooms}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors mb-6"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>

        {loading ? (
          <div className="text-center text-white/70 py-8">Загрузка...</div>
        ) : rooms.length === 0 ? (
          <div className="text-center text-white/70 py-8">
            Нет активных комнат
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-white/10 rounded-xl p-4 hover:bg-white/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-bold text-white">{room.id}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStateColor(room.state)}`}>
                        {getStateLabel(room.state)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-white/70 text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{room.playerCount} игроков</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        <span>{room.redPlayers}</span>
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span>{room.bluePlayers}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleQuickJoin(room.id)}
                    className="ml-4 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl font-bold text-white hover:from-indigo-600 hover:to-purple-600 transition-all transform hover:scale-105"
                  >
                    <Play className="inline-block w-4 h-4 mr-1" />
                    Войти
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Join Form Modal */}
        {showJoinForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-white mb-4">
                Войти в комнату {joinRoomId}
              </h2>
              <input
                type="text"
                placeholder="Ваше имя"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/50 border-2 border-white/20 focus:border-white/50 outline-none mb-4"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom(joinRoomId)}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowJoinForm(false)}
                  className="flex-1 px-4 py-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => handleJoinRoom(joinRoomId)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl text-white font-bold hover:from-indigo-600 hover:to-purple-600 transition-all"
                >
                  Войти
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
