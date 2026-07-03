import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, extractIP } from '../auth/middleware';
import { AuthRequest, AlgorithmType } from '../types';
import { logger } from '../config/logger';
import { z } from 'zod';

const router = Router();

const checkRateLimitSchema = z.object({
  key: z.string().min(1, 'API key is required'),
  identifier: z.string().min(1, 'Identifier is required'),
});

/**
 * @swagger
 * /api/rate-limit/check:
 *   post:
 *     tags: [Rate Limiting]
 *     summary: Check if a request is allowed under the rate limit
 *     description: |
 *       Core rate limiting endpoint. Send the API key and an identifier
 *       (IP, user ID, etc.) to check if the request should be allowed.
 */
router.post('/check', async (req: AuthRequest, res: Response) => {
  try {
    const input = checkRateLimitSchema.parse(req.body);

    // Look up the API key
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: input.key },
      include: {
        policy: true,
        project: { select: { id: true, name: true, ownerId: true } },
      },
    });

    if (!apiKey || apiKey.status !== 'ACTIVE') {
      res.status(401).json({
        success: false,
        error: 'Invalid or revoked API key',
        code: 'INVALID_API_KEY',
      });
      return;
    }

    // Check if key has expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      res.status(401).json({
        success: false,
        error: 'API key has expired',
        code: 'API_KEY_EXPIRED',
      });
      return;
    }

    if (!apiKey.policy) {
      res.status(500).json({
        success: false,
        error: 'No rate limit policy configured for this key',
        code: 'NO_POLICY',
      });
      return;
    }

    // Import and use the rate limiter orchestrator
    const { RateLimiterOrchestrator } = await import('../rate-limiter');
    const { getRedisClient } = await import('../config/redis');
    const redis = getRedisClient();
    const orchestrator = new RateLimiterOrchestrator(redis);

    const result = await orchestrator.check(
      apiKey.project.id,
      input.identifier,
      {
        algorithm: apiKey.policy.algorithm as AlgorithmType,
        maxRequests: apiKey.policy.maxRequests,
        windowMs: apiKey.policy.windowMs,
        burstCapacity: apiKey.policy.burstCapacity || undefined,
        refillRate: apiKey.policy.refillRate || undefined,
      }
    );

    // Update lastUsedAt
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    // Log the request
    const logPromise = prisma.requestLog.create({
      data: {
        projectId: apiKey.project.id,
        apiKeyId: apiKey.id,
        identifier: input.identifier,
        method: req.method,
        path: req.path,
        statusCode: result.allowed ? 200 : 429,
        allowed: result.allowed,
        latencyMs: 0, // Will be calculated by middleware
        ipAddress: extractIP(req),
        userAgent: req.headers['user-agent'],
      },
    }).catch((err: Error) => {
      logger.error('Failed to log request', { error: err.message });
    });

    // Don't await log — fire and forget for performance
    Promise.resolve(logPromise);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': result.total.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetAt.toString(),
      'X-RateLimit-Algorithm': result.algorithm,
    });

    if (!result.allowed) {
      res.set({
        'Retry-After': (result.retryAfter || 1).toString(),
      });
    }

    res.status(result.allowed ? 200 : 429).json({
      success: result.allowed,
      data: {
        allowed: result.allowed,
        remaining: result.remaining,
        total: result.total,
        resetAt: result.resetAt,
        retryAfter: result.retryAfter,
        algorithm: result.algorithm,
      },
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Rate limit check failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/rate-limit/bulk-check:
 *   post:
 *     tags: [Rate Limiting]
 *     summary: Check rate limits for multiple identifiers at once
 */
router.post('/bulk-check', async (req: AuthRequest, res: Response) => {
  try {
    const { key, identifiers } = req.body;

    if (!key || !Array.isArray(identifiers) || identifiers.length === 0) {
      res.status(400).json({ success: false, error: 'API key and identifiers array required' });
      return;
    }

    if (identifiers.length > 100) {
      res.status(400).json({ success: false, error: 'Max 100 identifiers per bulk check' });
      return;
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { key },
      include: { policy: true, project: { select: { id: true } } },
    });

    if (!apiKey || apiKey.status !== 'ACTIVE' || !apiKey.policy) {
      res.status(401).json({ success: false, error: 'Invalid or revoked API key' });
      return;
    }

    const { RateLimiterOrchestrator } = await import('../rate-limiter');
    const { getRedisClient } = await import('../config/redis');
    const redis = getRedisClient();
    const orchestrator = new RateLimiterOrchestrator(redis);

    const results = await Promise.all(
      identifiers.map(async (identifier: string) => {
        const result = await orchestrator.check(apiKey.project.id, identifier, {
          algorithm: apiKey.policy!.algorithm as AlgorithmType,
          maxRequests: apiKey.policy!.maxRequests,
          windowMs: apiKey.policy!.windowMs,
          burstCapacity: apiKey.policy!.burstCapacity || undefined,
          refillRate: apiKey.policy!.refillRate || undefined,
        });
        return { identifier, ...result };
      })
    );

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
