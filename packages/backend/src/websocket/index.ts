import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../config/logger';

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server for live metrics streaming.
 * Clients connect to /ws and join a room per project.
 */
export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
    path: '/ws',
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    logger.info('WebSocket client connected', { socketId: socket.id });

    // Join a project room to receive its metrics
    socket.on('subscribe', (projectId: string) => {
      socket.join(`project:${projectId}`);
      logger.debug('Client subscribed to project', { socketId: socket.id, projectId });
    });

    // Leave a project room
    socket.on('unsubscribe', (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug('WebSocket client disconnected', { socketId: socket.id, reason });
    });
  });

  logger.info('WebSocket server initialized on /ws');
  return io;
}

/**
 * Broadcast metrics to all subscribers of a project.
 */
export function broadcastMetrics(projectId: string, metrics: Record<string, unknown>): void {
  if (!io) return;
  io.to(`project:${projectId}`).emit('metrics', {
    projectId,
    timestamp: Date.now(),
    ...metrics,
  });
}

/**
 * Broadcast a rate limit event (allowed/blocked).
 */
export function broadcastRateLimitEvent(
  projectId: string,
  event: { identifier: string; allowed: boolean; algorithm: string }
): void {
  if (!io) return;
  io.to(`project:${projectId}`).emit('rate-limit', {
    projectId,
    timestamp: Date.now(),
    ...event,
  });
}

export function getIO(): SocketIOServer | null {
  return io;
}
