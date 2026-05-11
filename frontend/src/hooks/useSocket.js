import { useState, useEffect, useCallback } from 'react';
import { connectSocket, disconnectSocket } from '../socket/socket';

const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = connectSocket();
    setSocket(s);

    s.on('connect', () => {
      console.log('[Socket] Connected successfully!');
      setConnected(true);
    });
    
    s.on('connect_error', (err) => {
      console.error('[Socket Error]', err.message);
      setConnected(false);
    });

    s.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
    });

    return () => {
      s.off('connect');
      s.off('connect_error');
      s.off('disconnect');
      disconnectSocket();
    };
  }, []);

  const on = useCallback((event, handler) => {
    if (socket) socket.on(event, handler);
  }, [socket]);

  const off = useCallback((event, handler) => {
    if (socket) socket.off(event, handler);
  }, [socket]);

  const emit = useCallback((event, data) => {
    if (socket && socket.connected) socket.emit(event, data);
  }, [socket]);

  return { socket, connected, on, off, emit };
};

export default useSocket;
