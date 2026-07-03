import { AlgorithmType, RateLimitConfig } from '../../types';
import { BaseRateLimiter } from '../base';
import { keyManager } from '../keys';
import { TOKEN_BUCKET_SCRIPT } from '../scripts';

/**
 * Token Bucket Rate Limiter
 *
 * Maintains a bucket of tokens that refills at a constant rate.
 * Each request consumes one token. Allows controlled bursts up to capacity.
 *
 * Parameters:
 *   capacity (burstCapacity): max tokens in bucket = max burst size
 *   refillRate: tokens added per windowMs
 *
 * Pros: Allows bursts, smooth long-term rate, industry standard (AWS, Stripe)
 * Cons: Slightly more complex, 2 hash fields per key
 *
 * Redis key: fs:{project}:{id}:tb (hash: tokens, last_refill)
 * TTL: 3x windowMs (lazy cleanup)
 */
export class TokenBucketLimiter extends BaseRateLimiter {
  readonly algorithm = AlgorithmType.TOKEN_BUCKET;

  async check(key: string, config: RateLimitConfig): Promise<ReturnType<typeof this.buildResult>> {
    const redisKey = `fs:${key}:tb`;
    const now = Date.now();
    const capacity = config.burstCapacity || config.maxRequests;
    const refillRate = config.refillRate || config.maxRequests;

    const result = await this.redis.eval(
      TOKEN_BUCKET_SCRIPT,
      1,
      redisKey,
      capacity.toString(),
      refillRate.toString(),
      config.windowMs.toString(),
      now.toString(),
      '1'  // consume 1 token per request
    ) as number[];

    return this.buildResult(
      result[0] === 1,
      result[1],
      result[2],
      result[3],
      result[4]  // retryAfter
    );
  }
}
