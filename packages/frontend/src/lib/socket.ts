import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const API_URL = import.meta.env.VITE_API_URL || '';
    socket = io(API_URL || undefined, {
      path: '/ws',
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function subscribeToProject(projectId: string, callback: (metrics: Record<string, unknown>) => void) {
  const s = getSocket();
  s.emit('subscribe', projectId);
  s.on('metrics', callback);
  return () => {
    s.emit('unsubscribe', projectId);
    s.off('metrics', callback);
  };
}
