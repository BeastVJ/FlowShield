import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger, stream } from './config/logger';
import { getRedisClient } from './config/redis';
import { RateLimiterOrchestrator } from './rate-limiter';

// Routes
import authRoutes from './auth/routes';
import projectRoutes from './routes/projects';
import apiKeyRoutes from './routes/api-keys';
import rateLimitRoutes from './routes/rate-limit';
import analyticsRoutes from './routes/analytics';
import auditRoutes from './routes/audit';

const app = express();

// ── Global Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors(config.cors));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// ── Health Check ───────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const redis = getRedisClient();
  const redisOk = redis?.status === 'ready';

  res.json({
    status: redisOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      redis: redisOk ? 'connected' : 'disconnected',
    },
  });
});

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', apiKeyRoutes);
app.use('/api/rate-limit', rateLimitRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit', auditRoutes);

// ── Swagger Documentation ──────────────────────────────────────
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FlowShield API',
      version: '1.0.0',
      description: 'Production-Grade Rate Limiter as a Service',
    },
    servers: [
      { url: `http://localhost:${config.port}`, description: 'Development' },
      ...(config.frontendUrl ? [{ url: config.frontendUrl, description: 'Production' }] : []),
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FlowShield API Docs',
}));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── 404 Handler ────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
});

// ── Global Error Handler ───────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

export default app;
