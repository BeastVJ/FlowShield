import { AlgorithmType, RateLimitConfig } from '../../types';
import { BaseRateLimiter } from '../base';
import { FIXED_WINDOW_SCRIPT } from '../scripts';
import { logger } from '../../config/logger';

/**
 * Fixed Window Rate Limiter
 *
 * Divides time into fixed windows (e.g., per minute). Counts requests
 * in each window and resets when the window expires.
 *
 * Pros: Simple, low memory (single counter), easy to understand
 * Cons: Burst at window boundaries (2x traffic at edge)
 *
 * Redis key: fs:{project}:{id}:fw:{window_start}
 * TTL: 2x windowMs
 * Atomic: Lua script ensures no race between GET and INCR
 */
export class FixedWindowLimiter extends BaseRateLimiter {
  readonly algorithm = AlgorithmType.FIXED_WINDOW;

  async check(key: string, config: RateLimitConfig): Promise<ReturnType<typeof this.buildResult>> {
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const redisKey = `fs:${key}:fw:${windowStart}`;
    logger.info('FixedWindow check', { redisKey, windowStart, now, windowMs: config.windowMs });

    const result = await this.redis.eval(
      FIXED_WINDOW_SCRIPT,
      1,
      redisKey,
      config.maxRequests.toString(),
      config.windowMs.toString(),
      now.toString()
    ) as number[];

    return this.buildResult(
      result[0] === 1,       // allowed
      result[1],             // remaining
      result[2],             // total
      result[3]              // resetAt
    );
  }
}
