import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    name: process.env.POSTGRES_DB || 'flowshield',
    user: process.env.POSTGRES_USER || 'flowshield',
    password: process.env.POSTGRES_PASSWORD || 'password',
  },

  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetries: 3,
    retryDelay: 1000,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },

  rateLimit: {
    defaultMax: parseInt(process.env.DEFAULT_RATE_LIMIT || '100', 10),
    defaultWindowMs: parseInt(process.env.DEFAULT_WINDOW_MS || '60000', 10),
  },

  websocket: {
    port: parseInt(process.env.WS_PORT || '3001', 10),
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
  },
} as const;

export type Config = typeof config;
