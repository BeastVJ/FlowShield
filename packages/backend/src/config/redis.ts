import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const baseOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > config.redis.maxRetries) {
          logger.error('Redis: Max reconnection attempts reached');
          return null;
        }
        const delay = Math.min(times * config.redis.retryDelay, 5000);
        logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      enableReadyCheck: true,
      lazyConnect: false,
    };

    // Support both REDIS_URL (full connection string, e.g. from Render)
    // and individual host/port/password env vars
    if (config.redis.url) {
      redisClient = new Redis(config.redis.url, baseOptions);
    } else {
      redisClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        ...baseOptions,
      });
    }

    redisClient.on('connect', () => {
      logger.info('Redis: Connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis: Ready');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis: Error', { error: err.message });
    });

    redisClient.on('close', () => {
      logger.warn('Redis: Connection closed');
    });
  }

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
