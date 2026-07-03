import { nanoid } from 'nanoid';
import { AlgorithmType, RateLimitConfig } from '../../types';
import { BaseRateLimiter } from '../base';
import { keyManager } from '../keys';
import { SLIDING_LOG_SCRIPT } from '../scripts';

/**
 * Sliding Log Rate Limiter
 *
 * Maintains a sorted set of all request timestamps within the window.
 * Most accurate algorithm — exact count of requests in any time period.
 *
 * Pros: Perfectly accurate, no boundary effects
 * Cons: Higher memory (stores every timestamp), O(log N) per request
 *
 * Redis key: fs:{project}:{id}:sl (sorted set)
 * TTL: windowMs
 * Atomic: Lua script cleans old entries + checks count + adds new entry
 */
export class SlidingLogLimiter extends BaseRateLimiter {
  readonly algorithm = AlgorithmType.SLIDING_LOG;

  async check(key: string, config: RateLimitConfig): Promise<ReturnType<typeof this.buildResult>> {
    const redisKey = `fs:${key}:sl`;
    const now = Date.now();
    const uniqueId = `${now}:${nanoid(8)}`;

    const result = await this.redis.eval(
      SLIDING_LOG_SCRIPT,
      1,
      redisKey,
      config.maxRequests.toString(),
      config.windowMs.toString(),
      now.toString(),
      uniqueId
    ) as number[];

    return this.buildResult(
      result[0] === 1,
      result[1],
      result[2],
      result[3],
      result[4]  // retryAfter (optional)
    );
  }
}
