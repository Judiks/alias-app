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
function createRoom(hostId, hostName) {
  return {
    id: uuidv4().slice(0, 6).toUpperCase(),
    host: hostId,
    teams: {
      red: { players: [], score: 0, currentExplainerIndex: 0 },
      blue: { players: [], score: 0, currentExplainerIndex: 0 }
    },
    settings: {
      roundTime: 60,
      wordsToWin: 50,
      skipPenalty: true
    },
    state: 'lobby', // lobby, playing, paused, finished
    roundNumber: 0,
    currentRound: {
      team: 'red',
      explainer: null,
      word: null,
      timeLeft: 60,
      wordsGuessed: 0,
      wordsSkipped: 0
    },
    words: [],
    usedWords: new Set(),
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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let currentRoom = null;
  let playerName = null;

  // Create room
  socket.on('create-room', async ({ name }) => {
    const room = createRoom(socket.id, name);
    room.words = await getWords(500);
    rooms.set(room.id, room);
    
    room.teams.red.players.push({ id: socket.id, name, isHost: true });
    currentRoom = room.id;
    playerName = name;
    
    socket.join(room.id);
    socket.emit('room-created', { roomId: room.id, room });
    console.log(`Room ${room.id} created by ${name}`);
  });

  // Join room
  socket.on('join-room', async ({ roomId, name, team }) => {
    const room = rooms.get(roomId.toUpperCase());
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    if (room.state !== 'lobby') {
      socket.emit('error', { message: 'Игра уже началась' });
      return;
    }

    const targetTeam = team || (room.teams.red.players.length <= room.teams.blue.players.length ? 'red' : 'blue');
    room.teams[targetTeam].players.push({ id: socket.id, name, isHost: false });
    
    currentRoom = room.id;
    playerName = name;
    
    socket.join(room.id);
    socket.emit('room-joined', { roomId: room.id, room, team: targetTeam });
    io.to(room.id).emit('room-updated', { room });
    console.log(`${name} joined room ${room.id} in team ${targetTeam}`);
  });

  // Switch team
  socket.on('switch-team', ({ team }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.state !== 'lobby') return;

    // Remove from current team
    ['red', 'blue'].forEach(t => {
      room.teams[t].players = room.teams[t].players.filter(p => p.id !== socket.id);
    });

    // Add to new team
    room.teams[team].players.push({ id: socket.id, name: playerName, isHost: room.host === socket.id });
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

  // Start game
  socket.on('start-game', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.host !== socket.id) return;

    if (room.teams.red.players.length < 1 || room.teams.blue.players.length < 1) {
      socket.emit('error', { message: 'Нужно минимум по 1 игроку в каждой команде' });
      return;
    }

    room.state = 'playing';
    room.currentRound = {
      team: 'red',
      explainer: room.teams.red.players[0].id,
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

    // Check win condition
    if (room.teams[room.currentRound.team].score >= room.settings.wordsToWin) {
      endGame(room);
      return;
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
    room.teams.red.score = 0;
    room.teams.blue.score = 0;
    room.teams.red.currentExplainerIndex = 0;
    room.teams.blue.currentExplainerIndex = 0;
    room.roundNumber = 1;
    room.state = 'playing';
    room.usedWords.clear();
    room.words = await getWords(500);

    room.currentRound = {
      team: 'red',
      explainer: room.teams.red.players[0]?.id,
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
    room.teams.red.score = 0;
    room.teams.blue.score = 0;
    room.roundNumber = 0;

    io.to(room.id).emit('back-to-lobby', { room });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (!currentRoom) return;
    
    const room = rooms.get(currentRoom);
    if (!room) return;

    // Remove player from teams
    ['red', 'blue'].forEach(team => {
      room.teams[team].players = room.teams[team].players.filter(p => p.id !== socket.id);
    });

    // If host left, assign new host or delete room
    if (room.host === socket.id) {
      const allPlayers = [...room.teams.red.players, ...room.teams.blue.players];
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
  if (room.words.length === 0) {
    room.words = Array.from(room.usedWords);
    room.usedWords.clear();
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
      // Wait for last word decision
      room.state = 'last-word';
      io.to(room.id).emit('last-word', { room });
    }
  }, 1000);
}

function nextTurn(room) {
  const currentTeam = room.currentRound.team;
  const nextTeam = currentTeam === 'red' ? 'blue' : 'red';
  
  // Increment round number when switching back to red
  if (nextTeam === 'red') {
    room.roundNumber++;
  }
  
  // Get next explainer from the team (rotate through players)
  const teamData = room.teams[nextTeam];
  if (teamData.players.length === 0) {
    endGame(room);
    return;
  }
  
  // Move to next explainer in the team
  teamData.currentExplainerIndex = (teamData.currentExplainerIndex + 1) % teamData.players.length;
  const nextExplainer = teamData.players[teamData.currentExplainerIndex];

  if (!nextExplainer) {
    endGame(room);
    return;
  }

  // Set break state
  room.state = 'break';
  room.currentRound = {
    team: nextTeam,
    explainer: nextExplainer.id,
    word: null,
    timeLeft: 10, // 10 second break
    wordsGuessed: 0,
    wordsSkipped: 0
  };

  io.to(room.id).emit('break-started', { room, nextTeam, explainerName: nextExplainer.name });
  
  // Start break countdown
  let breakTime = 10;
  const breakInterval = setInterval(() => {
    breakTime--;
    io.to(room.id).emit('break-tick', { timeLeft: breakTime });
    
    if (breakTime <= 0) {
      clearInterval(breakInterval);
      startActualTurn(room, nextTeam, nextExplainer);
    }
  }, 1000);
}

function startActualTurn(room, team, explainer) {
  room.state = 'playing';
  room.currentRound = {
    team: team,
    explainer: explainer.id,
    word: getNextWord(room),
    timeLeft: room.settings.roundTime,
    wordsGuessed: 0,
    wordsSkipped: 0
  };

  io.to(room.id).emit('turn-changed', { room });
  startRoundTimer(room);
}

function endGame(room) {
  room.state = 'finished';
  const winner = room.teams.red.score > room.teams.blue.score ? 'red' : 
                 room.teams.blue.score > room.teams.red.score ? 'blue' : 'tie';
  
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
