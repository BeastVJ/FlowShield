import Redis from 'ioredis';
import { AlgorithmType, RateLimitConfig, RateLimitResult } from '../types';
import { IRateLimiter } from './base';
import {
  FixedWindowLimiter,
  SlidingWindowLimiter,
  SlidingLogLimiter,
  TokenBucketLimiter,
  LeakyBucketLimiter,
} from './algorithms';
import { keyManager } from './keys';
import { ANALYTICS_INCREMENT_SCRIPT } from './scripts';
import { logger } from '../config/logger';

/**
 * Rate Limiter Orchestrator
 *
 * - Factory that creates the correct algorithm instance
 * - Project-aware: keys are scoped per project + API key
 * - Collects analytics (allowed/blocked counts, RPS) atomically
 * - Supports hot-swapping algorithms at runtime
 */
export class RateLimiterOrchestrator {
  private limiters: Map<AlgorithmType, IRateLimiter>;
  private defaultConfig: RateLimitConfig;

  constructor(private readonly redis: Redis) {
    this.limiters = new Map<AlgorithmType, IRateLimiter>([
      [AlgorithmType.FIXED_WINDOW, new FixedWindowLimiter(redis)],
      [AlgorithmType.SLIDING_WINDOW, new SlidingWindowLimiter(redis)],
      [AlgorithmType.SLIDING_LOG, new SlidingLogLimiter(redis)],
      [AlgorithmType.TOKEN_BUCKET, new TokenBucketLimiter(redis)],
      [AlgorithmType.LEAKY_BUCKET, new LeakyBucketLimiter(redis)],
    ]);

    this.defaultConfig = {
      algorithm: AlgorithmType.FIXED_WINDOW,
      maxRequests: 100,
      windowMs: 60000,
    };
  }

  /**
   * Check rate limit for a given key under a specific project.
   * Returns whether the request is allowed and metadata.
   */
  async check(
    projectId: string,
    identifier: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const mergedConfig: RateLimitConfig = {
      ...this.defaultConfig,
      ...config,
    };

    const limiter = this.limiters.get(mergedConfig.algorithm);
    if (!limiter) {
      throw new Error(`Unknown algorithm: ${mergedConfig.algorithm}`);
    }

    // Build scoped key: {projectId}:{identifier}
    const scopedKey = `${projectId}:${identifier}`;
    const start = Date.now();

    try {
      const result = await limiter.check(scopedKey, mergedConfig);
      logger.info('Rate limit result', { scopedKey, result });

      // Collect analytics asynchronously (fire-and-forget)
      this.recordAnalytics(projectId, result.allowed, Date.now() - start).catch((err) => {
        logger.error('Failed to record analytics', { error: err.message });
      });

      return result;
    } catch (err) {
      logger.error('Rate limit check failed', {
        projectId,
        identifier,
        algorithm: mergedConfig.algorithm,
        error: (err as Error).message,
        stack: (err as Error).stack,
      });

      // Fail open: allow request if Redis is down
      return {
        allowed: true,
        remaining: mergedConfig.maxRequests,
        total: mergedConfig.maxRequests,
        resetAt: Date.now() + mergedConfig.windowMs,
        algorithm: mergedConfig.algorithm,
      };
    }
  }

  /**
   * Record analytics metrics atomically in Redis.
   */
  private async recordAnalytics(
    projectId: string,
    allowed: boolean,
    latencyMs: number
  ): Promise<void> {
    const now = Date.now();
    const totalKey = keyManager.analyticsCounter(projectId, 'total');
    const allowedKey = keyManager.analyticsCounter(projectId, 'allowed');
    const blockedKey = keyManager.analyticsCounter(projectId, 'blocked');
    const rpsKey = keyManager.analyticsRPS(projectId);

    await this.redis.eval(
      ANALYTICS_INCREMENT_SCRIPT,
      4,
      totalKey,
      allowedKey,
      blockedKey,
      rpsKey,
      now.toString(),
      allowed ? '1' : '0',
      '60000'
    );
  }

  /**
   * Get analytics summary for a project.
   */
  async getAnalytics(projectId: string): Promise<{
    total: number;
    allowed: number;
    blocked: number;
    currentRPS: number;
  }> {
    const [total, allowed, blocked] = await Promise.all([
      this.redis.get(keyManager.analyticsCounter(projectId, 'total')),
      this.redis.get(keyManager.analyticsCounter(projectId, 'allowed')),
      this.redis.get(keyManager.analyticsCounter(projectId, 'blocked')),
    ]);

    // Calculate current RPS from sorted set
    const rpsKey = keyManager.analyticsRPS(projectId);
    const minuteAgo = Date.now() - 60000;
    await this.redis.zremrangebyscore(rpsKey, '-inf', minuteAgo.toString());
    const rpsCount = await this.redis.zcard(rpsKey);

    return {
      total: parseInt(total || '0', 10),
      allowed: parseInt(allowed || '0', 10),
      blocked: parseInt(blocked || '0', 10),
      currentRPS: rpsCount,
    };
  }

  /**
   * Reset analytics counters for a project.
   */
  async resetAnalytics(projectId: string): Promise<void> {
    const keys = [
      keyManager.analyticsCounter(projectId, 'total'),
      keyManager.analyticsCounter(projectId, 'allowed'),
      keyManager.analyticsCounter(projectId, 'blocked'),
      keyManager.analyticsRPS(projectId),
    ];
    await this.redis.del(...keys);
  }
}
