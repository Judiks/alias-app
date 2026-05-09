import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { socket, connectSocket } from './socket';
import Home from './pages/Home';
import Room from './pages/Room';
import Game from './pages/Game';
import LobbyList from './pages/LobbyList';

function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    connectSocket();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  return (
    <div className="min-h-screen text-white">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobbies" element={<LobbyList />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/game/:roomId" element={<Game />} />
      </Routes>
      
      {!connected && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div className="text-xl">Подключение к серверу...</div>
            <div className="text-sm text-indigo-300 mt-2">Сервер может просыпаться до 30 сек</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
