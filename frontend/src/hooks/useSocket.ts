import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

let socket: Socket | null = null

export const useSocket = () => {
  const { accessToken, isAuthenticated } = useAuthStore()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return

    if (!socket) {
      socket = io(SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
      })

      socket.on('connect', () => console.log('Socket connected'))
      socket.on('connect_error', (err) => console.error('Socket error:', err))
      socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason))
    }

    socketRef.current = socket
    return () => {
      // Don't disconnect on component unmount, keep persistent connection
    }
  }, [isAuthenticated, accessToken])

  return socketRef.current
}

export const getSocket = () => socket

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
