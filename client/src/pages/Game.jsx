import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { socket } from '../socket';
import { Check, X, Clock, Trophy, RotateCcw } from 'lucide-react';

export default function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get initial room from navigation state
  const initialRoom = location.state?.room || null;
  
  const [room, setRoom] = useState(initialRoom);
  const [timeLeft, setTimeLeft] = useState(initialRoom?.currentRound?.timeLeft || 60);
  const [currentWord, setCurrentWord] = useState('');
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isBreak, setIsBreak] = useState(false);
  const [breakInfo, setBreakInfo] = useState(null);
  const [isLastWord, setIsLastWord] = useState(false);
  
  // Compute these from room state directly
  const isExplainer = room?.currentRound?.explainer === socket.id;
  let myTeam = null;
  let myTeamData = null;
  if (room?.teams) {
    room.teams.forEach(team => {
      const player = team.players.find(p => p.id === socket.id);
      if (player) {
        myTeam = team.id;
        myTeamData = team;
      }
    });
  }

  useEffect(() => {
    // If no room data and page was accessed directly, redirect to room
    if (!room && !initialRoom) {
      const timer = setTimeout(() => {
        navigate(`/room/${roomId}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [room, initialRoom, roomId, navigate]);

  // Initialize word only once on mount
  useEffect(() => {
    if (initialRoom && initialRoom.currentRound?.explainer === socket.id) {
      setCurrentWord(initialRoom.currentRound.word);
    }
  }, []);

  useEffect(() => {
    socket.on('game-started', ({ room: newRoom }) => {
      setRoom(newRoom);
      if (newRoom.currentRound?.explainer === socket.id) {
        setCurrentWord(newRoom.currentRound.word);
      }
      setTimeLeft(newRoom.currentRound?.timeLeft || 60);
    });

    socket.on('room-updated', ({ room: newRoom }) => {
      setRoom(newRoom);
    });

    socket.on('turn-changed', ({ room: newRoom }) => {
      setRoom(newRoom);
      setIsBreak(false);
      setBreakInfo(null);
      setIsLastWord(false);
      if (newRoom.currentRound?.explainer === socket.id) {
        setCurrentWord(newRoom.currentRound.word);
      } else {
        setCurrentWord('');
      }
      setTimeLeft(newRoom.currentRound?.timeLeft || 60);
    });

    socket.on('timer-tick', ({ timeLeft: newTime }) => {
      setTimeLeft(newTime);
    });

    socket.on('break-started', ({ room: newRoom, teamIndex, teamId, teamName, explainerName, isFinalChance }) => {
      setRoom(newRoom);
      setIsBreak(true);
      setBreakInfo({ teamIndex, teamId, teamName, explainerName, isFinalChance });
      setTimeLeft(10);
    });

    socket.on('goal-reached', ({ team, score }) => {
      // Could show a notification here
      console.log(`${team} reached goal with ${score} points!`);
    });

    socket.on('break-tick', ({ timeLeft: newTime }) => {
      setTimeLeft(newTime);
    });

    socket.on('last-word', ({ room: newRoom }) => {
      setRoom(newRoom);
      setIsLastWord(true);
      setTimeLeft(30);
    });

    socket.on('last-word-tick', ({ timeLeft: newTime }) => {
      setTimeLeft(newTime);
    });

    socket.on('word-result', ({ correct, room: updatedRoom, newWord }) => {
      // Update room but DON'T let it affect timeLeft display
      setRoom(prev => ({
        ...updatedRoom,
        currentRound: {
          ...updatedRoom.currentRound,
          // Keep the current timeLeft from previous state
          timeLeft: prev?.currentRound?.timeLeft
        }
      }));
      // Only update word for explainer
      if (updatedRoom.currentRound.explainer === socket.id && newWord) {
        setCurrentWord(newWord);
      }
    });

    socket.on('game-ended', ({ room: newRoom, winner: gameWinner }) => {
      setRoom(newRoom);
      setGameEnded(true);
      setWinner(gameWinner);
    });

    socket.on('game-restarted', ({ room: newRoom }) => {
      setRoom(newRoom);
      setGameEnded(false);
      setWinner(null);
      if (newRoom.currentRound?.explainer === socket.id) {
        setCurrentWord(newRoom.currentRound.word);
      }
      setTimeLeft(newRoom.currentRound?.timeLeft || 60);
    });

    socket.on('back-to-lobby', ({ room: newRoom }) => {
      navigate(`/room/${newRoom.id}`, { state: { room: newRoom, fromGame: true } });
    });

    return () => {
      socket.off('game-started');
      socket.off('room-updated');
      socket.off('turn-changed');
      socket.off('timer-tick');
      socket.off('break-started');
      socket.off('goal-reached');
      socket.off('break-tick');
      socket.off('last-word');
      socket.off('last-word-tick');
      socket.off('word-result');
      socket.off('game-ended');
      socket.off('game-restarted');
      socket.off('back-to-lobby');
    };
  }, [navigate]);

  const handleCorrect = () => {
    socket.emit('word-correct');
  };

  const handleSkip = () => {
    socket.emit('word-skip');
  };

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white">Загрузка игры...</div>
      </div>
    );
  }

  const isHost = room.host === socket.id;

  const handleRestart = () => {
    socket.emit('restart-game');
    setGameEnded(false);
    setWinner(null);
  };

  const handleBackToLobby = () => {
    socket.emit('back-to-lobby');
  };

  // Break screen between turns
  if (isBreak && breakInfo) {
    const nextTeamName = breakInfo.teamName;
    const nextTeamData = room?.teams?.find(t => t.id === breakInfo.teamId);

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center max-w-md w-full">
          {breakInfo.isFinalChance ? (
            <>
              <div className="text-6xl mb-4">🔥</div>
              <h1 className="text-3xl font-bold mb-2 text-yellow-400">Финальный шанс!</h1>
              <p className="text-indigo-300 mb-4">
                Последний шанс догнать лидеров!
              </p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">⏸️</div>
              <h1 className="text-3xl font-bold mb-4">Перерыв</h1>
            </>
          )}

          <div className={`inline-block px-4 py-2 rounded-full mb-4 bg-${nextTeamData?.color || 'gray'}-500/30 text-${nextTeamData?.color || 'gray'}-300`}>
            Следующий ход: <strong>{nextTeamName}</strong>
          </div>

          <div className="text-indigo-300 mb-6">
            Объясняет: <strong>{breakInfo.explainerName}</strong>
          </div>

          <div className="text-6xl font-mono font-bold mb-4">{timeLeft}</div>
          <div className="text-indigo-400">Приготовьтесь!</div>

          {/* Current scores */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {room?.teams?.map((team) => (
              <div key={team.id} className="text-center">
                <div className="text-sm">{team.emoji} {team.name}</div>
                <div className="text-2xl font-bold">{team.score}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (gameEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center max-w-md w-full">
          <Trophy className={`w-24 h-24 mx-auto mb-4 ${
            winner ? 'text-yellow-400' : 'text-gray-400'
          }`} />
          <h1 className="text-4xl font-bold mb-4">
            {winner ? `${winner.emoji} ${winner.name} победили!` : 'Ничья!'}
          </h1>
          <div className="text-indigo-300 mb-2">Раунд: {room.roundNumber || 1}</div>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {room?.teams?.map((team) => (
              <div key={team.id} className={`text-center ${winner?.id === team.id ? 'scale-110' : ''}`}>
                <div className="text-sm">{team.emoji} {team.name}</div>
                <div className="text-4xl font-bold">{team.score}</div>
              </div>
            ))}
          </div>
          {isHost ? (
            <div className="space-y-3">
              <button
                onClick={handleRestart}
                className="w-full py-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl font-bold text-lg hover:from-green-500 hover:to-emerald-600 transition-all"
              >
                <RotateCcw className="inline-block w-5 h-5 mr-2" />
                Играть снова
              </button>
              <button
                onClick={handleBackToLobby}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              >
                В лобби (сменить команды)
              </button>
            </div>
          ) : (
            <div className="text-indigo-300">
              Ожидание хоста...
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentTeamData = room?.teams?.find(t => t.id === room.currentRound?.teamId);
  const currentTeamName = currentTeamData?.name || 'Команда';
  const currentTeamColor = currentTeamData?.color || 'gray';
  const explainerName = room?.teams?.flatMap(t => t.players)
    .find(p => p.id === room.currentRound?.explainer)?.name || 'Игрок';

  const isMyTeamTurn = myTeam === room.currentRound?.teamId;

  return (
    <div className="min-h-screen p-4 flex flex-col">
      {/* Round & Goal */}
      <div className="text-center mb-2">
        <span className="text-indigo-300 text-sm">
          Раунд {room.roundNumber || 1} • Цель: {room.settings?.wordsToWin || 50} очков
        </span>
      </div>

      {/* Score Board */}
      <div className="flex flex-wrap justify-center gap-4 mb-4">
        {room?.teams?.map((team) => (
          <div key={team.id} className={`text-center px-4 py-2 rounded-xl ${room.currentRound?.teamId === team.id ? 'bg-white/40 ring-2 ring-white' : 'bg-white/10'}`}>
            <div className="text-sm">{team.emoji} {team.name}</div>
            <div className="text-2xl font-bold">{team.score}/{room.settings?.wordsToWin || 50}</div>
          </div>
        ))}
      </div>

      {/* Timer */}
      <div className="flex justify-center mb-6">
        <div className={`flex items-center gap-2 px-6 py-3 rounded-2xl ${
          isLastWord ? 'bg-yellow-500/40 animate-pulse' :
          timeLeft <= 10 ? 'bg-red-500/40 animate-pulse' : 'bg-white/10'
        }`}>
          <Clock className="w-6 h-6" />
          <span className="text-4xl font-mono font-bold">{timeLeft}</span>
        </div>
      </div>
      
      {/* Last word indicator */}
      {isLastWord && (
        <div className="text-center mb-4">
          <span className="bg-yellow-500/30 text-yellow-300 px-4 py-2 rounded-full text-lg font-bold">
            ⚡ Последнее слово!
          </span>
        </div>
      )}

      {/* Current Turn Info */}
      <div className="text-center mb-6">
        <div className={`inline-block px-4 py-2 rounded-full bg-${currentTeamColor}-500/30 text-${currentTeamColor}-300`}>
          Ход команды: <strong>{currentTeamData?.emoji} {currentTeamName}</strong>
        </div>
        <div className="text-indigo-300 mt-2">
          Объясняет: <strong>{explainerName}</strong>
          {isExplainer && <span className="text-yellow-400"> (это вы!)</span>}
        </div>
      </div>

      {/* Word Card */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <div className="bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-lg rounded-3xl p-8 text-center shadow-2xl">
            
            {/* Explainer view - shows word and buttons */}
            {isExplainer && (
              <>
                <div className="text-sm text-indigo-300 mb-2">
                  {isLastWord ? '⚡ Последнее слово:' : 'Объясните это слово:'}
                </div>
                <div className="text-5xl md:text-6xl font-bold mb-8 text-shadow break-words">
                  {currentWord || room.currentRound?.word || '...'}
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleSkip}
                    className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl font-bold text-xl hover:from-orange-600 hover:to-red-600 transition-all transform hover:scale-105 active:scale-95"
                  >
                    <X className="inline-block w-6 h-6 mr-2" />
                    {isLastWord ? 'Не угадали' : 'Пропустить'}
                  </button>
                  <button
                    onClick={handleCorrect}
                    className="flex-1 py-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl font-bold text-xl hover:from-green-500 hover:to-emerald-600 transition-all transform hover:scale-105 active:scale-95"
                  >
                    <Check className="inline-block w-6 h-6 mr-2" />
                    Угадали!
                  </button>
                </div>
              </>
            )}
            
            {/* Guessing team - can't see word */}
            {!isExplainer && isMyTeamTurn && (
              <>
                <div className="text-6xl mb-4">🎯</div>
                <div className="text-2xl font-bold mb-2">Угадывайте!</div>
                <div className="text-indigo-300">
                  {explainerName} объясняет слово
                </div>
              </>
            )}
            
            {/* Enemy team - can see word for proof */}
            {!isExplainer && !isMyTeamTurn && (
              <>
                <div className="text-sm text-indigo-300 mb-2">Текущее слово (для проверки):</div>
                <div className="text-5xl md:text-6xl font-bold mb-4 text-shadow break-words">
                  {currentWord || room.currentRound?.word || '...'}
                </div>
                <div className="text-indigo-400">⏳ Ход соперников</div>
              </>
            )}
          </div>
          <div className="text-center mt-4 text-indigo-300 text-sm">
            Угадано: {room.currentRound?.wordsGuessed || 0} | Пропущено: {room.currentRound?.wordsSkipped || 0}
          </div>
        </div>
      </div>

      {/* Goal */}
      <div className="text-center text-indigo-400 text-sm mt-4">
        Цель: {room.settings.wordsToWin} очков
      </div>
    </div>
  );
}
