import { io } from 'socket.io-client';

// Clean the URL (remove trailing slash and accidental /api)
const SOCKET_URL = (process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000')
  .replace(/\/$/, '')
  .replace(/\/api$/, '');

let socket = null;

export const getSocket = () => {
  if (!socket) {
    console.log('[Socket] Connecting to:', SOCKET_URL);
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['polling', 'websocket'], // Try polling first for better compatibility
      withCredentials: true
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) socket.disconnect();
};

export default getSocket;
