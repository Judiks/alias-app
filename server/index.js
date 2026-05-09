import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { getWords, initWordCache } from './wordService.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Game rooms storage
const rooms = new Map();

// Room structure
function createRoom(hostId, hostName, roomName) {
  return {
    id: uuidv4().slice(0, 6).toUpperCase(),
    name: roomName || 'Моя комната',
    host: hostId,
    teams: [
      { id: 'team-1', name: 'Команда 1', color: 'red', players: [], score: 0, currentExplainerIndex: 0, emoji: '🔴' },
      { id: 'team-2', name: 'Команда 2', color: 'blue', players: [], score: 0, currentExplainerIndex: 0, emoji: '🔵' }
    ],
    settings: {
      roundTime: 60,
      wordsToWin: 50,
      skipPenalty: true,
      isPrivate: false
    },
    state: 'lobby',
    roundNumber: 0,
    currentRound: null,
    words: [],
    usedWords: new Set(),
    goalReached: false,
    teamsPlayedFinal: new Set(),
    createdAt: Date.now()
  };
}

// API endpoint to create room
app.post('/api/rooms', async (req, res) => {
  const roomId = uuidv4().slice(0, 6).toUpperCase();
  res.json({ roomId });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

// Get list of all active rooms
app.get('/api/rooms', (req, res) => {
  const roomList = [];
  rooms.forEach((room, id) => {
    const totalPlayers = room.teams.reduce((sum, team) => sum + team.players.length, 0);
    roomList.push({
      id: room.id,
      name: room.name,
      state: room.state,
      playerCount: totalPlayers,
      teamCount: room.teams.length,
      isPrivate: room.settings.isPrivate,
      roundNumber: room.roundNumber
    });
  });
  res.json({ rooms: roomList });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let currentRoom = null;
  let playerName = null;

  // Get rooms list
  socket.on('get-rooms', () => {
    const roomList = [];
    rooms.forEach((room) => {
      const totalPlayers = room.teams.reduce((sum, team) => sum + team.players.length, 0);
      roomList.push({
        id: room.id,
        name: room.name,
        state: room.state,
        playerCount: totalPlayers,
        teamCount: room.teams.length,
        isPrivate: room.settings.isPrivate,
        roundNumber: room.roundNumber
      });
    });
    socket.emit('rooms-list', { rooms: roomList });
  });

  // Create room
  socket.on('create-room', async ({ name, roomName }) => {
    const room = createRoom(socket.id, name, roomName);
    room.words = await getWords(2000); // Load many words, shuffled to mix all difficulty levels
    rooms.set(room.id, room);

    room.teams[0].players.push({ id: socket.id, name, isHost: true });
    currentRoom = room.id;
    playerName = name;

    socket.join(room.id);
    socket.emit('room-created', { roomId: room.id, room });
    console.log(`Room ${room.id} (${room.name}) created by ${name}`);
  });

  // Join room
  socket.on('join-room', async ({ roomId, name, teamId }) => {
    const room = rooms.get(roomId.toUpperCase());

    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    if (room.state !== 'lobby') {
      socket.emit('error', { message: 'Игра уже началась' });
      return;
    }

    // Find the team with the fewest players, or use specified team
    let targetTeamIndex = 0;
    if (teamId) {
      targetTeamIndex = room.teams.findIndex(t => t.id === teamId);
      if (targetTeamIndex === -1) targetTeamIndex = 0;
    } else {
      // Find team with fewest players
      let minPlayers = Infinity;
      room.teams.forEach((team, index) => {
        if (team.players.length < minPlayers) {
          minPlayers = team.players.length;
          targetTeamIndex = index;
        }
      });
    }

    room.teams[targetTeamIndex].players.push({ id: socket.id, name, isHost: false });

    currentRoom = room.id;
    playerName = name;

    socket.join(room.id);
    socket.emit('room-joined', { roomId: room.id, room, teamId: room.teams[targetTeamIndex].id });
    io.to(room.id).emit('room-updated', { room });
    console.log(`${name} joined room ${room.id} in team ${room.teams[targetTeamIndex].name}`);
  });

  // Switch team
  socket.on('switch-team', ({ teamId }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.state !== 'lobby') return;

    // Remove from current team
    room.teams.forEach(team => {
      team.players = team.players.filter(p => p.id !== socket.id);
    });

    // Add to new team
    const targetTeam = room.teams.find(t => t.id === teamId);
    if (targetTeam) {
      targetTeam.players.push({ id: socket.id, name: playerName, isHost: room.host === socket.id });
    }

    io.to(room.id).emit('room-updated', { room });
  });

  // Update settings
  socket.on('update-settings', ({ settings }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.host !== socket.id) return;

    room.settings = { ...room.settings, ...settings };
    io.to(room.id).emit('room-updated', { room });
  });

  // Add team
  socket.on('add-team', ({ name }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.host !== socket.id || room.state !== 'lobby') return;
    if (room.teams.length >= 10) {
      socket.emit('error', { message: 'Максимум 10 команд' });
      return;
    }

    const teamId = `team-${Date.now()}`;
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'cyan', 'lime', 'indigo'];
    const emojis = ['🔴', '🔵', '🟢', '🟡', '🟣', '🩷', '🟠', '🔷', '💚', '🔮'];
    const colorIndex = room.teams.length % colors.length;

    room.teams.push({
      id: teamId,
      name: name || `Команда ${room.teams.length + 1}`,
      color: colors[colorIndex],
      emoji: emojis[colorIndex],
      players: [],
      score: 0,
      currentExplainerIndex: 0
    });

    io.to(room.id).emit('room-updated', { room });
  });

  // Remove team
  socket.on('remove-team', ({ teamId }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.host !== socket.id || room.state !== 'lobby') return;
    if (room.teams.length <= 2) {
      socket.emit('error', { message: 'Минимум 2 команды' });
      return;
    }

    room.teams = room.teams.filter(t => t.id !== teamId);
    io.to(room.id).emit('room-updated', { room });
  });

  // Rename team
  socket.on('rename-team', ({ teamId, name }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.host !== socket.id) return;

    const team = room.teams.find(t => t.id === teamId);
    if (team) {
      team.name = name || team.name;
      io.to(room.id).emit('room-updated', { room });
    }
  });

  // Start game
  socket.on('start-game', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.host !== socket.id) return;

    // Check if at least 2 teams have players
    const teamsWithPlayers = room.teams.filter(t => t.players.length > 0);
    if (teamsWithPlayers.length < 2) {
      socket.emit('error', { message: 'Нужно минимум 2 команды с игроками' });
      return;
    }

    room.state = 'playing';
    room.roundNumber = 1;
    room.currentRound = {
      teamIndex: 0,
      teamId: room.teams[0].id,
      explainer: room.teams[0].players[0]?.id,
      word: getNextWord(room),
      timeLeft: room.settings.roundTime,
      wordsGuessed: 0,
      wordsSkipped: 0
    };

    io.to(room.id).emit('game-started', { room });
    startRoundTimer(room);
  });

  // Word guessed correctly
  socket.on('word-correct', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || (room.state !== 'playing' && room.state !== 'last-word')) return;
    if (socket.id !== room.currentRound.explainer) return;

    room.teams[room.currentRound.team].score++;
    room.currentRound.wordsGuessed++;

    // Mark if goal is reached (but don't end game yet)
    if (room.teams[room.currentRound.team].score >= room.settings.wordsToWin) {
      room.goalReached = true;
      io.to(room.id).emit('goal-reached', { 
        team: room.currentRound.team, 
        score: room.teams[room.currentRound.team].score 
      });
    }

    // If it was last word, go to next turn
    if (room.state === 'last-word') {
      nextTurn(room);
      return;
    }

    room.currentRound.word = getNextWord(room);
    io.to(room.id).emit('word-result', { 
      correct: true, 
      room,
      newWord: room.currentRound.word 
    });
  });

  // Skip word / Not guessed (for last word)
  socket.on('word-skip', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || (room.state !== 'playing' && room.state !== 'last-word')) return;
    if (socket.id !== room.currentRound.explainer) return;

    // If it was last word, just go to next turn (no penalty for not guessing last word)
    if (room.state === 'last-word') {
      nextTurn(room);
      return;
    }

    if (room.settings.skipPenalty) {
      room.teams[room.currentRound.team].score = Math.max(0, room.teams[room.currentRound.team].score - 1);
    }
    room.currentRound.wordsSkipped++;
    room.currentRound.word = getNextWord(room);

    io.to(room.id).emit('word-result', { 
      correct: false, 
      room,
      newWord: room.currentRound.word 
    });
  });

  // Restart game (new game with same players)
  socket.on('restart-game', async () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    if (socket.id !== room.host) return;

    // Reset scores and state
    room.teams.forEach(team => {
      team.score = 0;
      team.currentExplainerIndex = 0;
    });
    room.roundNumber = 1;
    room.state = 'playing';
    room.goalReached = false;
    room.teamsPlayedFinal.clear();
    room.usedWords.clear();
    room.words = await getWords(500);

    room.currentRound = {
      teamIndex: 0,
      teamId: room.teams[0].id,
      explainer: room.teams[0].players[0]?.id,
      word: getNextWord(room),
      timeLeft: room.settings.roundTime,
      wordsGuessed: 0,
      wordsSkipped: 0
    };

    io.to(room.id).emit('game-restarted', { room });
    startRoundTimer(room);
  });

  // Back to lobby
  socket.on('back-to-lobby', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    if (socket.id !== room.host) return;

    room.state = 'lobby';
    room.teams.forEach(team => {
      team.score = 0;
      team.currentExplainerIndex = 0;
    });
    room.roundNumber = 0;
    room.goalReached = false;
    room.teamsPlayedFinal.clear();

    io.to(room.id).emit('back-to-lobby', { room });
  });

  // Leave room
  socket.on('leave-room', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    // Remove player from teams
    room.teams.forEach(team => {
      team.players = team.players.filter(p => p.id !== socket.id);
    });

    // Leave socket room
    socket.leave(room.id);

    // If host left, assign new host or delete room
    if (room.host === socket.id) {
      const allPlayers = room.teams.flatMap(team => team.players);
      if (allPlayers.length > 0) {
        room.host = allPlayers[0].id;
        allPlayers[0].isHost = true;
        io.to(room.id).emit('room-updated', { room });
      } else {
        rooms.delete(room.id);
      }
    } else {
      io.to(room.id).emit('room-updated', { room });
    }

    currentRoom = null;
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    // Remove player from teams
    room.teams.forEach(team => {
      team.players = team.players.filter(p => p.id !== socket.id);
    });

    // If host left, assign new host or delete room
    if (room.host === socket.id) {
      const allPlayers = room.teams.flatMap(team => team.players);
      if (allPlayers.length > 0) {
        room.host = allPlayers[0].id;
        allPlayers[0].isHost = true;
      } else {
        rooms.delete(room.id);
        return;
      }
    }

    io.to(room.id).emit('room-updated', { room });
  });
});

// Helper functions
function getNextWord(room) {
  // If we run out of words, reload from the full list (shouldn't happen often)
  if (room.words.length === 0) {
    console.log('Words exhausted, reloading...');
    room.words = Array.from(room.usedWords);
    room.usedWords.clear();
    // Shuffle
    room.words.sort(() => Math.random() - 0.5);
  }
  
  const word = room.words.pop();
  room.usedWords.add(word);
  return word;
}

function startRoundTimer(room) {
  const interval = setInterval(() => {
    if (!rooms.has(room.id) || room.state !== 'playing') {
      clearInterval(interval);
      return;
    }

    room.currentRound.timeLeft--;
    io.to(room.id).emit('timer-tick', { timeLeft: room.currentRound.timeLeft });

    if (room.currentRound.timeLeft <= 0) {
      clearInterval(interval);
      // Last word - 30 seconds to decide
      room.state = 'last-word';
      room.currentRound.timeLeft = 30;
      io.to(room.id).emit('last-word', { room });
      startLastWordTimer(room);
    }
  }, 1000);
}

function startLastWordTimer(room) {
  const interval = setInterval(() => {
    if (!rooms.has(room.id) || room.state !== 'last-word') {
      clearInterval(interval);
      return;
    }

    room.currentRound.timeLeft--;
    io.to(room.id).emit('last-word-tick', { timeLeft: room.currentRound.timeLeft });

    if (room.currentRound.timeLeft <= 0) {
      clearInterval(interval);
      // Time's up for last word - count as not guessed
      nextTurn(room);
    }
  }, 1000);
}

function nextTurn(room) {
  const currentTeamIndex = room.currentRound.teamIndex;
  const nextTeamIndex = (currentTeamIndex + 1) % room.teams.length;

  // Check win conditions with multiple teams
  if (room.goalReached) {
    const currentTeamId = room.teams[currentTeamIndex].id;
    if (!room.teamsPlayedFinal.has(currentTeamId)) {
      room.teamsPlayedFinal.add(currentTeamId);
    }

    // Check if all teams have played their final turn
    const allTeamsPlayedFinal = room.teams.every(team => room.teamsPlayedFinal.has(team.id));
    if (allTeamsPlayedFinal) {
      endGame(room);
      return;
    }
  }

  // Increment round number when cycling back to first team
  if (nextTeamIndex === 0) {
    room.roundNumber++;
  }

  // Get next team
  const nextTeam = room.teams[nextTeamIndex];
  if (nextTeam.players.length === 0) {
    // Skip empty teams
    if (room.teams.every(t => t.players.length === 0)) {
      endGame(room);
      return;
    }
    nextTurn(room);
    return;
  }

  // Move to next explainer in the team
  nextTeam.currentExplainerIndex = (nextTeam.currentExplainerIndex + 1) % nextTeam.players.length;
  const nextExplainer = nextTeam.players[nextTeam.currentExplainerIndex];

  if (!nextExplainer) {
    endGame(room);
    return;
  }

  // Set break state
  room.state = 'break';
  room.currentRound = {
    teamIndex: nextTeamIndex,
    teamId: nextTeam.id,
    explainer: nextExplainer.id,
    word: null,
    timeLeft: 10,
    wordsGuessed: 0,
    wordsSkipped: 0
  };

  const isFinalChance = room.goalReached && !room.teamsPlayedFinal.has(nextTeam.id);

  io.to(room.id).emit('break-started', {
    room,
    teamIndex: nextTeamIndex,
    teamId: nextTeam.id,
    teamName: nextTeam.name,
    explainerName: nextExplainer.name,
    isFinalChance
  });

  let breakTime = 10;
  const breakInterval = setInterval(() => {
    breakTime--;
    io.to(room.id).emit('break-tick', { timeLeft: breakTime });

    if (breakTime <= 0) {
      clearInterval(breakInterval);
      startActualTurn(room, nextTeamIndex, nextTeam, nextExplainer);
    }
  }, 1000);
}

function startActualTurn(room, teamIndex, team, explainer) {
  room.state = 'playing';
  room.currentRound = {
    teamIndex: teamIndex,
    teamId: team.id,
    explainer: explainer.id,
    word: getNextWord(room),
    timeLeft: room.settings.roundTime,
    wordsGuessed: 0,
    wordsSkipped: 0
  };

  io.to(room.id).emit('turn-started', { room, teamIndex, teamId: team.id, teamName: team.name, explainerName: explainer.name });
  startRoundTimer(room);
}

function endGame(room) {
  room.state = 'finished';

  // Find winning team(s)
  let maxScore = -1;
  room.teams.forEach(team => {
    if (team.score > maxScore) {
      maxScore = team.score;
    }
  });

  const winners = room.teams.filter(team => team.score === maxScore);
  const winner = winners.length === 1 ? winners[0] : null; // null if tie

  io.to(room.id).emit('game-ended', { room, winner });
}

// Keep server alive (prevent Render sleep)
function keepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3001}`;
  if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
      fetch(`${url}/api/health`)
        .then(() => console.log('Keep-alive ping sent'))
        .catch(() => {});
    }, 14 * 60 * 1000); // Every 14 minutes
  }
}

// Start server
const PORT = process.env.PORT || 3001;

initWordCache().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    keepAlive();
  });
});
