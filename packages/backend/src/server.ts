import http from 'http';
import app from './app';
import { config } from './config';
import { logger } from './config/logger';
import { getRedisClient, closeRedis } from './config/redis';
import prisma from './config/database';
import { initWebSocket } from './websocket';

async function startServer() {
  try {
    // Initialize Redis connection
    const redis = getRedisClient();
    await redis.ping();
    logger.info('Redis connection verified');

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Initialize WebSocket
    initWebSocket(httpServer);

    // Start listening
    httpServer.listen(config.port, () => {
      logger.info(`🚀 FlowShield API server running on port ${config.port}`);
      logger.info(`📖 API docs: http://localhost:${config.port}/api/docs`);
      logger.info(`🔌 WebSocket: ws://localhost:${config.port}/ws`);
      logger.info(`💚 Health: http://localhost:${config.port}/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      httpServer.close(async () => {
        await closeRedis();
        await prisma.$disconnect();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Failed to start server', { error: (err as Error).message });
    process.exit(1);
  }
}

startServer();
