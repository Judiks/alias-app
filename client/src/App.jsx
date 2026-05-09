import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { socket, connectSocket } from './socket';
import Home from './pages/Home';
import Room from './pages/Room';
import Game from './pages/Game';

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
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/game/:roomId" element={<Game />} />
      </Routes>
      
      {!connected && (
        <div className="fixed bottom-4 right-4 bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm">
          Подключение к серверу...
        </div>
      )}
    </div>
  );
}

export default App;
