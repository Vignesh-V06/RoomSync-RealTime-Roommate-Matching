import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

const joinAuthenticatedUserRoom = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.id && socket?.connected) {
      socket.emit('join_user', user.id);
    }
  } catch {
    // A missing or malformed local user record should not break the socket client.
  }
};

export const initSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('token');
    socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 8,
      timeout: 10000
    });

    socket.on('connect', joinAuthenticatedUserRoom);
  }

  if (socket.connected) joinAuthenticatedUserRoom();
  return socket;
};

export const getSocket = () => initSocket();

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
