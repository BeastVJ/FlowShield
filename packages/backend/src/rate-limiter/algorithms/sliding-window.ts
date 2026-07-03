import { AlgorithmType, RateLimitConfig } from '../../types';
import { BaseRateLimiter } from '../base';
import { keyManager } from '../keys';
import { SLIDING_WINDOW_SCRIPT } from '../scripts';

/**
 * Sliding Window Counter (Hybrid) Rate Limiter
 *
 * Combines fixed windows with weighted interpolation to approximate
 * a true sliding window. Uses current + previous window counters.
 *
 * accuracy = previous_count * (1 - elapsed/window) + current_count
 *
 * Pros: Good accuracy (~99%), low memory (2 counters), smooth transitions
 * Cons: Slightly approximate, not exact like sliding log
 *
 * Redis keys: fs:{project}:{id}:sw:{current_window}, fs:{project}:{id}:sw:{prev_window}
 * TTL: 2x windowMs (covers both windows)
 */
export class SlidingWindowLimiter extends BaseRateLimiter {
  readonly algorithm = AlgorithmType.SLIDING_WINDOW;

  async check(key: string, config: RateLimitConfig): Promise<ReturnType<typeof this.buildResult>> {
    const windowStart = Math.floor(Date.now() / config.windowMs) * config.windowMs;
    const currentKey = `fs:${key}:sw:${windowStart}`;
    const previousKey = `fs:${key}:sw:${windowStart - config.windowMs}`;
    const now = Date.now();

    const result = await this.redis.eval(
      SLIDING_WINDOW_SCRIPT,
      2,
      currentKey,
      previousKey,
      config.maxRequests.toString(),
      config.windowMs.toString(),
      now.toString()
    ) as number[];

    return this.buildResult(
      result[0] === 1,
      result[1],
      result[2],
      result[3]
    );
  }
}
