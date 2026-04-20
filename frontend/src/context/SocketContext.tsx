import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

// FIX: Export SocketContext so it can be used by useSocket hook
export const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'], // FIX: polling as fallback
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => console.log('Socket connected'));
    s.on('connect_error', (err) => console.error('Socket error:', err.message));
    // FIX: Handle token expiry via socket disconnect
    s.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server forced disconnect — likely auth issue
        console.warn('Socket disconnected by server');
      }
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
