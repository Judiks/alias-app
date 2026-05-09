import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { socket } from '../socket';
import { Copy, Check, Settings, Play, Users, Crown } from 'lucide-react';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get initial state from navigation
  const initialRoom = location.state?.room || null;
  const initialTeam = location.state?.team || (location.state?.isCreator ? 'red' : null);
  const initialIsHost = location.state?.isCreator || false;
  
  const [room, setRoom] = useState(initialRoom);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [myTeam, setMyTeam] = useState(initialTeam);
  const [isHost, setIsHost] = useState(initialIsHost);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [joinName, setJoinName] = useState('');

  useEffect(() => {
    socket.on('room-updated', ({ room }) => {
      setRoom(room);
      updateMyStatus(room);
    });

    socket.on('room-joined', ({ room, team }) => {
      setRoom(room);
      setMyTeam(team);
      setNeedsJoin(false);
      updateMyStatus(room);
    });

    socket.on('room-created', ({ room }) => {
      setRoom(room);
      setMyTeam('red');
      setIsHost(true);
    });

    socket.on('game-started', ({ room }) => {
      navigate(`/game/${roomId}`);
    });

    socket.on('error', ({ message }) => {
      alert(message);
      if (message === 'Комната не найдена') {
        navigate('/');
      }
    });

    // If we don't have room data, we need to join
    // Check after a short delay to allow for socket events
    const timer = setTimeout(() => {
      if (!room) {
        setNeedsJoin(true);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      socket.off('room-updated');
      socket.off('room-joined');
      socket.off('room-created');
      socket.off('game-started');
      socket.off('error');
    };
  }, [roomId, navigate, room]);

  const handleQuickJoin = () => {
    if (!joinName.trim()) return;
    socket.emit('join-room', { roomId: roomId.toUpperCase(), name: joinName.trim() });
  };

  const updateMyStatus = (room) => {
    const inRed = room.teams.red.players.find(p => p.id === socket.id);
    const inBlue = room.teams.blue.players.find(p => p.id === socket.id);
    setMyTeam(inRed ? 'red' : inBlue ? 'blue' : null);
    setIsHost(room.host === socket.id);
  };

  const copyLink = () => {
    const base = import.meta.env.BASE_URL || '/';
    const link = `${window.location.origin}${base}room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const switchTeam = (team) => {
    socket.emit('switch-team', { team });
  };

  const updateSettings = (settings) => {
    socket.emit('update-settings', { settings });
  };

  const startGame = () => {
    socket.emit('start-game');
  };

  if (!room) {
    // Show join form if user came directly via link
    if (needsJoin) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-center mb-2">Присоединиться к комнате</h2>
            <p className="text-center text-indigo-300 mb-6">Код: <span className="font-mono text-xl">{roomId}</span></p>
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Ваше имя..."
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickJoin()}
            />
            <button
              onClick={handleQuickJoin}
              disabled={!joinName.trim()}
              className="w-full py-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl font-bold text-lg hover:from-green-500 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Войти в комнату
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 mt-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
            >
              На главную
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white">Загрузка комнаты...</div>
      </div>
    );
  }

  const canStart = room.teams.red.players.length >= 1 && room.teams.blue.players.length >= 1;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Комната</h1>
          <div className="flex items-center gap-2">
            <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-xl font-mono text-2xl tracking-widest">
              {roomId}
            </div>
            <button
              onClick={copyLink}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              title="Скопировать ссылку"
            >
              {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
            </button>
            {isHost && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && isHost && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Настройки игры
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-indigo-200 mb-2">Время раунда (сек)</label>
                <input
                  type="number"
                  value={room.settings.roundTime}
                  onChange={(e) => updateSettings({ roundTime: parseInt(e.target.value) || 60 })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  min={30}
                  max={180}
                />
              </div>
              <div>
                <label className="block text-sm text-indigo-200 mb-2">Очков для победы</label>
                <input
                  type="number"
                  value={room.settings.wordsToWin}
                  onChange={(e) => updateSettings({ wordsToWin: parseInt(e.target.value) || 50 })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  min={10}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-sm text-indigo-200 mb-2">Штраф за пропуск</label>
                <button
                  onClick={() => updateSettings({ skipPenalty: !room.settings.skipPenalty })}
                  className={`w-full px-4 py-2 rounded-lg border transition-all ${
                    room.settings.skipPenalty
                      ? 'bg-red-500/30 border-red-500 text-red-300'
                      : 'bg-green-500/30 border-green-500 text-green-300'
                  }`}
                >
                  {room.settings.skipPenalty ? 'Включен (-1 очко)' : 'Выключен'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Teams */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Red Team */}
          <div className={`bg-gradient-to-br from-red-500/30 to-red-600/20 backdrop-blur rounded-2xl p-6 border-2 ${myTeam === 'red' ? 'border-red-400' : 'border-transparent'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-red-300 flex items-center gap-2">
                <Users className="w-5 h-5" /> Красные
              </h3>
              <span className="text-2xl font-bold">{room.teams.red.players.length}</span>
            </div>
            <div className="space-y-2 mb-4 min-h-[100px]">
              {room.teams.red.players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    player.id === socket.id ? 'bg-red-500/40' : 'bg-white/10'
                  }`}
                >
                  {player.isHost && <Crown className="w-4 h-4 text-yellow-400" />}
                  <span>{player.name}</span>
                  {player.id === socket.id && <span className="text-xs text-red-300">(вы)</span>}
                </div>
              ))}
              {room.teams.red.players.length === 0 && (
                <div className="text-white/50 text-center py-4">Нет игроков</div>
              )}
            </div>
            {myTeam !== 'red' && (
              <button
                onClick={() => switchTeam('red')}
                className="w-full py-2 bg-red-500 hover:bg-red-600 rounded-lg font-semibold transition-all"
              >
                Присоединиться
              </button>
            )}
          </div>

          {/* Blue Team */}
          <div className={`bg-gradient-to-br from-blue-500/30 to-blue-600/20 backdrop-blur rounded-2xl p-6 border-2 ${myTeam === 'blue' ? 'border-blue-400' : 'border-transparent'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-blue-300 flex items-center gap-2">
                <Users className="w-5 h-5" /> Синие
              </h3>
              <span className="text-2xl font-bold">{room.teams.blue.players.length}</span>
            </div>
            <div className="space-y-2 mb-4 min-h-[100px]">
              {room.teams.blue.players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    player.id === socket.id ? 'bg-blue-500/40' : 'bg-white/10'
                  }`}
                >
                  {player.isHost && <Crown className="w-4 h-4 text-yellow-400" />}
                  <span>{player.name}</span>
                  {player.id === socket.id && <span className="text-xs text-blue-300">(вы)</span>}
                </div>
              ))}
              {room.teams.blue.players.length === 0 && (
                <div className="text-white/50 text-center py-4">Нет игроков</div>
              )}
            </div>
            {myTeam !== 'blue' && (
              <button
                onClick={() => switchTeam('blue')}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-all"
              >
                Присоединиться
              </button>
            )}
          </div>
        </div>

        {/* Start Button */}
        {isHost && (
          <button
            onClick={startGame}
            disabled={!canStart}
            className={`w-full py-4 rounded-2xl font-bold text-xl transition-all transform ${
              canStart
                ? 'bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 hover:scale-105'
                : 'bg-gray-500/50 cursor-not-allowed'
            }`}
          >
            <Play className="inline-block w-6 h-6 mr-2" />
            {canStart ? 'Начать игру!' : 'Нужно минимум по 1 игроку в команде'}
          </button>
        )}

        {!isHost && (
          <div className="text-center text-indigo-300 py-4">
            Ожидание начала игры от хоста...
          </div>
        )}

        {/* Share Link */}
        <div className="mt-6 text-center">
          <p className="text-indigo-300 mb-2">Поделитесь ссылкой с друзьями:</p>
          <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 flex items-center justify-between">
            <code className="text-sm text-indigo-200 truncate">
              {window.location.origin}{import.meta.env.BASE_URL || '/'}room/{roomId}
            </code>
            <button
              onClick={copyLink}
              className="ml-2 px-4 py-1 bg-purple-500 hover:bg-purple-600 rounded-lg text-sm transition-all"
            >
              {copied ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
