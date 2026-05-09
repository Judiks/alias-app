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
  const [isExplainer, setIsExplainer] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState(null);
  const [myTeam, setMyTeam] = useState(null);

  useEffect(() => {
    // If no room data and page was accessed directly, redirect to room
    if (!room && !initialRoom) {
      const timer = setTimeout(() => {
        navigate(`/room/${roomId}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
    
    if (initialRoom) {
      updateGameState(initialRoom, true);
    }
  }, [room, initialRoom, roomId, navigate]);

  useEffect(() => {
    socket.on('game-started', ({ room }) => {
      setRoom(room);
      updateGameState(room, true);
    });

    socket.on('room-updated', ({ room }) => {
      setRoom(room);
      updateGameState(room, false);
    });

    socket.on('turn-changed', ({ room }) => {
      setRoom(room);
      // Update team membership
      const inRed = room.teams.red.players.find(p => p.id === socket.id);
      const inBlue = room.teams.blue.players.find(p => p.id === socket.id);
      setMyTeam(inRed ? 'red' : inBlue ? 'blue' : null);
      // Force update explainer status
      setIsExplainer(room.currentRound?.explainer === socket.id);
      if (room.currentRound?.explainer === socket.id) {
        setCurrentWord(room.currentRound.word);
      } else {
        setCurrentWord('');
      }
      setTimeLeft(room.currentRound?.timeLeft || 60);
    });

    socket.on('timer-tick', ({ timeLeft }) => {
      setTimeLeft(timeLeft);
    });

    socket.on('word-result', ({ correct, room: updatedRoom, newWord }) => {
      // Update room but preserve current timeLeft (don't reset timer)
      setRoom(prev => ({
        ...updatedRoom,
        currentRound: {
          ...updatedRoom.currentRound,
          timeLeft: prev?.currentRound?.timeLeft || updatedRoom.currentRound.timeLeft
        }
      }));
      if (updatedRoom.currentRound.explainer === socket.id) {
        setCurrentWord(newWord);
      }
    });

    socket.on('game-ended', ({ room, winner }) => {
      setRoom(room);
      setGameEnded(true);
      setWinner(winner);
    });

    socket.on('game-restarted', ({ room }) => {
      setRoom(room);
      setGameEnded(false);
      setWinner(null);
      updateGameState(room, true);
    });

    socket.on('back-to-lobby', ({ room }) => {
      navigate(`/room/${room.id}`);
    });

    return () => {
      socket.off('game-started');
      socket.off('room-updated');
      socket.off('turn-changed');
      socket.off('timer-tick');
      socket.off('word-result');
      socket.off('game-ended');
      socket.off('game-restarted');
      socket.off('back-to-lobby');
    };
  }, [navigate]);

  const updateGameState = (room, updateTimer = false) => {
    if (!room) return;
    
    const inRed = room.teams.red.players.find(p => p.id === socket.id);
    const inBlue = room.teams.blue.players.find(p => p.id === socket.id);
    setMyTeam(inRed ? 'red' : inBlue ? 'blue' : null);
    
    setIsExplainer(room.currentRound?.explainer === socket.id);
    
    // Only update timer on turn change or game start
    if (updateTimer) {
      setTimeLeft(room.currentRound?.timeLeft || 60);
    }
    
    if (room.currentRound?.explainer === socket.id) {
      setCurrentWord(room.currentRound.word);
    } else {
      setCurrentWord('');
    }
  };

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

  if (gameEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center max-w-md w-full">
          <Trophy className={`w-24 h-24 mx-auto mb-4 ${
            winner === 'red' ? 'text-red-400' : winner === 'blue' ? 'text-blue-400' : 'text-yellow-400'
          }`} />
          <h1 className="text-4xl font-bold mb-4">
            {winner === 'tie' ? 'Ничья!' : winner === 'red' ? 'Красные победили!' : 'Синие победили!'}
          </h1>
          <div className="text-indigo-300 mb-2">Раунд: {room.roundNumber || 1}</div>
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-red-400 text-sm">Красные</div>
              <div className="text-4xl font-bold text-red-300">{room.teams.red.score}</div>
            </div>
            <div className="text-3xl text-white/50">:</div>
            <div className="text-center">
              <div className="text-blue-400 text-sm">Синие</div>
              <div className="text-4xl font-bold text-blue-300">{room.teams.blue.score}</div>
            </div>
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

  const currentTeamName = room.currentRound?.team === 'red' ? 'Красные' : 'Синие';
  const currentTeamColor = room.currentRound?.team === 'red' ? 'red' : 'blue';
  const explainerName = [...room.teams.red.players, ...room.teams.blue.players]
    .find(p => p.id === room.currentRound?.explainer)?.name || 'Игрок';

  const isMyTeamTurn = myTeam === room.currentRound?.team;

  return (
    <div className="min-h-screen p-4 flex flex-col">
      {/* Round & Goal */}
      <div className="text-center mb-2">
        <span className="text-indigo-300 text-sm">
          Раунд {room.roundNumber || 1} • Цель: {room.settings?.wordsToWin || 50} очков
        </span>
      </div>

      {/* Score Board */}
      <div className="flex justify-center gap-8 mb-4">
        <div className={`text-center px-6 py-2 rounded-xl ${room.currentRound?.team === 'red' ? 'bg-red-500/40 ring-2 ring-red-400' : 'bg-red-500/20'}`}>
          <div className="text-red-300 text-sm">Красные</div>
          <div className="text-3xl font-bold">{room.teams.red.score}/{room.settings?.wordsToWin || 50}</div>
        </div>
        <div className={`text-center px-6 py-2 rounded-xl ${room.currentRound?.team === 'blue' ? 'bg-blue-500/40 ring-2 ring-blue-400' : 'bg-blue-500/20'}`}>
          <div className="text-blue-300 text-sm">Синие</div>
          <div className="text-3xl font-bold">{room.teams.blue.score}/{room.settings?.wordsToWin || 50}</div>
        </div>
      </div>

      {/* Timer */}
      <div className="flex justify-center mb-6">
        <div className={`flex items-center gap-2 px-6 py-3 rounded-2xl ${
          timeLeft <= 10 ? 'bg-red-500/40 animate-pulse' : 'bg-white/10'
        }`}>
          <Clock className="w-6 h-6" />
          <span className="text-4xl font-mono font-bold">{timeLeft}</span>
        </div>
      </div>

      {/* Current Turn Info */}
      <div className="text-center mb-6">
        <div className={`inline-block px-4 py-2 rounded-full ${
          currentTeamColor === 'red' ? 'bg-red-500/30 text-red-300' : 'bg-blue-500/30 text-blue-300'
        }`}>
          Ход команды: <strong>{currentTeamName}</strong>
        </div>
        <div className="text-indigo-300 mt-2">
          Объясняет: <strong>{explainerName}</strong>
          {isExplainer && <span className="text-yellow-400"> (это вы!)</span>}
        </div>
      </div>

      {/* Word Card */}
      <div className="flex-1 flex items-center justify-center">
        {isExplainer ? (
          <div className="w-full max-w-lg">
            <div className="bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-lg rounded-3xl p-8 text-center shadow-2xl">
              <div className="text-sm text-indigo-300 mb-2">Объясните это слово:</div>
              <div className="text-5xl md:text-6xl font-bold mb-8 text-shadow break-words">
                {currentWord}
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleSkip}
                  className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl font-bold text-xl hover:from-orange-600 hover:to-red-600 transition-all transform hover:scale-105 active:scale-95"
                >
                  <X className="inline-block w-6 h-6 mr-2" />
                  Пропустить
                </button>
                <button
                  onClick={handleCorrect}
                  className="flex-1 py-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl font-bold text-xl hover:from-green-500 hover:to-emerald-600 transition-all transform hover:scale-105 active:scale-95"
                >
                  <Check className="inline-block w-6 h-6 mr-2" />
                  Угадали!
                </button>
              </div>
            </div>
            <div className="text-center mt-4 text-indigo-300 text-sm">
              Угадано: {room.currentRound?.wordsGuessed || 0} | Пропущено: {room.currentRound?.wordsSkipped || 0}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12">
              {isMyTeamTurn ? (
                <>
                  <div className="text-6xl mb-4">🎯</div>
                  <div className="text-2xl font-bold mb-2">Угадывайте слово!</div>
                  <div className="text-indigo-300">
                    {explainerName} объясняет слово вашей команде
                  </div>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">⏳</div>
                  <div className="text-2xl font-bold mb-2">Ход соперников</div>
                  <div className="text-indigo-300">
                    Дождитесь своего хода
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Goal */}
      <div className="text-center text-indigo-400 text-sm mt-4">
        Цель: {room.settings.wordsToWin} очков
      </div>
    </div>
  );
}
