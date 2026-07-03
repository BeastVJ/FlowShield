import { AlgorithmType, RateLimitConfig } from '../../types';
import { BaseRateLimiter } from '../base';
import { keyManager } from '../keys';
import { LEAKY_BUCKET_SCRIPT } from '../scripts';

/**
 * Leaky Bucket Rate Limiter
 *
 * Processes requests at a constant rate, queuing excess requests.
 * Requests "leak" out of the bucket at the configured rate.
 *
 * Parameters:
 *   capacity (burstCapacity): max queue size
 *   leakRate (refillRate): requests processed per windowMs
 *
 * Pros: Smoothest traffic output, constant processing rate
 * Cons: Adds latency for queued requests, memory for queue state
 *
 * Redis key: fs:{project}:{id}:lb (hash: queue_size, last_leak)
 * TTL: 3x windowMs
 */
export class LeakyBucketLimiter extends BaseRateLimiter {
  readonly algorithm = AlgorithmType.LEAKY_BUCKET;

  async check(key: string, config: RateLimitConfig): Promise<ReturnType<typeof this.buildResult>> {
    const redisKey = `fs:${key}:lb`;
    const now = Date.now();
    const capacity = config.burstCapacity || config.maxRequests;
    const leakRate = config.refillRate || config.maxRequests;

    const result = await this.redis.eval(
      LEAKY_BUCKET_SCRIPT,
      1,
      redisKey,
      capacity.toString(),
      leakRate.toString(),
      config.windowMs.toString(),
      now.toString()
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
