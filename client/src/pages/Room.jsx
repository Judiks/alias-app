import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { socket } from '../socket';
import { Copy, Check, Settings, Play, Users, Crown, LogOut } from 'lucide-react';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get initial state from navigation
  const initialRoom = location.state?.room || null;
  const fromGame = location.state?.fromGame || false;
  const initialTeam = location.state?.team || (location.state?.isCreator ? 'red' : null);
  const initialIsHost = location.state?.isCreator || false;
  
  const [room, setRoom] = useState(initialRoom);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [myTeam, setMyTeam] = useState(initialTeam);
  const [isHost, setIsHost] = useState(initialIsHost);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  // If returning from game, update status from room data
  useEffect(() => {
    if (fromGame && initialRoom) {
      updateMyStatus(initialRoom);
    }
  }, [fromGame, initialRoom]);

  // Try to reconnect from localStorage on page load
  useEffect(() => {
    const savedRoomId = localStorage.getItem('alias_room_id');
    const savedName = localStorage.getItem('alias_player_name');
    
    if (savedRoomId && savedName && roomId.toUpperCase() === savedRoomId.toUpperCase() && !initialRoom && !fromGame) {
      setIsReconnecting(true);
      socket.emit('join-room', { roomId: roomId.toUpperCase(), name: savedName });
    }
  }, [roomId, initialRoom, fromGame]);

  useEffect(() => {
    socket.on('room-updated', ({ room }) => {
      setRoom(room);
      updateMyStatus(room);
    });

    socket.on('room-joined', ({ room, team }) => {
      setRoom(room);
      setMyTeam(team);
      setNeedsJoin(false);
      setIsReconnecting(false);
      updateMyStatus(room);
      // Save to localStorage for reconnection
      localStorage.setItem('alias_room_id', room.id);
      localStorage.setItem('alias_player_name', room.teams[team]?.players?.find(p => p.id === socket.id)?.name || '');
    });

    socket.on('room-created', ({ room }) => {
      setRoom(room);
      setMyTeam('red');
      setIsHost(true);
      // Save to localStorage for reconnection
      const myName = room.teams.red.players.find(p => p.id === socket.id)?.name || '';
      localStorage.setItem('alias_room_id', room.id);
      localStorage.setItem('alias_player_name', myName);
    });

    socket.on('game-started', ({ room: gameRoom }) => {
      navigate(`/game/${roomId}`, { state: { room: gameRoom } });
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
    let foundTeamId = null;
    room.teams.forEach(team => {
      const player = team.players.find(p => p.id === socket.id);
      if (player) foundTeamId = team.id;
    });
    setMyTeam(foundTeamId);
    setIsHost(room.host === socket.id);
  };

  const copyLink = () => {
    const base = import.meta.env.BASE_URL || '/';
    const link = `${window.location.origin}${base}room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const switchTeam = (teamId) => {
    socket.emit('switch-team', { teamId });
  };

  const updateSettings = (settings) => {
    socket.emit('update-settings', { settings });
  };

  const startGame = () => {
    socket.emit('start-game');
  };

  const addTeam = () => {
    if (!newTeamName.trim()) return;
    socket.emit('add-team', { name: newTeamName.trim() });
    setNewTeamName('');
  };

  const removeTeam = (teamId) => {
    socket.emit('remove-team', { teamId });
  };

  const renameTeam = (teamId, name) => {
    socket.emit('rename-team', { teamId, name });
  };

  const leaveRoom = () => {
    // Clear localStorage
    localStorage.removeItem('alias_room_id');
    localStorage.removeItem('alias_player_name');
    // Leave socket room
    socket.emit('leave-room');
    // Navigate to home
    navigate('/');
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

  const canStart = room.teams.filter(t => t.players.length > 0).length >= 2;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">{room.name || 'Комната'}</h1>
            <div className="bg-white/10 backdrop-blur px-3 py-1 rounded-lg font-mono text-lg tracking-widest mt-1 inline-block">
              {roomId}
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <button
              onClick={leaveRoom}
              className="p-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl transition-all text-red-300"
              title="Покинуть комнату"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && isHost && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Настройки игры
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                <label className="block text-sm text-indigo-200 mb-2">Приватная комната</label>
                <button
                  onClick={() => updateSettings({ isPrivate: !room.settings.isPrivate })}
                  className={`w-full px-4 py-2 rounded-lg border transition-all ${
                    room.settings.isPrivate
                      ? 'bg-yellow-500/30 border-yellow-500 text-yellow-300'
                      : 'bg-green-500/30 border-green-500 text-green-300'
                  }`}
                >
                  {room.settings.isPrivate ? '🔒 Приватная' : '🔓 Публичная'}
                </button>
              </div>
            </div>

            {/* Team Management */}
            <div className="border-t border-white/20 pt-4">
              <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" /> Управление командами
              </h4>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Название новой команды"
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50"
                  maxLength={20}
                />
                <button
                  onClick={addTeam}
                  disabled={room.teams.length >= 10 || !newTeamName.trim()}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Добавить
                </button>
              </div>
              <div className="space-y-2">
                {room.teams.map((team) => (
                  <div key={team.id} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                    <span className="text-xl">{team.emoji}</span>
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => renameTeam(team.id, e.target.value)}
                      className="flex-1 px-3 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
                      maxLength={20}
                    />
                    <button
                      onClick={() => removeTeam(team.id)}
                      disabled={room.teams.length <= 2}
                      className="px-3 py-1 bg-red-500/50 hover:bg-red-500 rounded text-white text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-indigo-300 mt-2">Минимум 2 команды, максимум 10</p>
            </div>
          </div>
        )}

        {/* Teams */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {room.teams.map((team) => (
            <div
              key={team.id}
              className={`bg-gradient-to-br from-${team.color}-500/30 to-${team.color}-600/20 backdrop-blur rounded-2xl p-6 border-2 ${myTeam === team.id ? `border-${team.color}-400` : 'border-transparent'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-${team.color}-300 flex items-center gap-2">
                  <span className="text-2xl">{team.emoji}</span>
                  {team.name}
                </h3>
                <span className="text-2xl font-bold">{team.players.length}</span>
              </div>
              <div className="space-y-2 mb-4 min-h-[100px]">
                {team.players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      player.id === socket.id ? `bg-${team.color}-500/40` : 'bg-white/10'
                    }`}
                  >
                    {player.isHost && <Crown className="w-4 h-4 text-yellow-400" />}
                    <span>{player.name}</span>
                    {player.id === socket.id && <span className="text-xs text-red-300">(вы)</span>}
                  </div>
                ))}
                {team.players.length === 0 && (
                  <div className="text-white/50 text-center py-4">Нет игроков</div>
                )}
              </div>
              {myTeam !== team.id && room.state === 'lobby' && (
                <button
                  onClick={() => switchTeam(team.id)}
                  className={`w-full py-2 bg-${team.color}-500 hover:bg-${team.color}-600 rounded-lg font-semibold transition-all`}
                >
                  Присоединиться
                </button>
              )}
            </div>
          ))}
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
