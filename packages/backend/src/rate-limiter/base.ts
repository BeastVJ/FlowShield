import Redis from 'ioredis';
import { AlgorithmType, RateLimitConfig, RateLimitResult } from '../types';

export interface IRateLimiter {
  readonly algorithm: AlgorithmType;
  check(key: string, config: RateLimitConfig): Promise<RateLimitResult>;
}

export abstract class BaseRateLimiter implements IRateLimiter {
  abstract readonly algorithm: AlgorithmType;

  constructor(protected readonly redis: Redis) {}

  abstract check(key: string, config: RateLimitConfig): Promise<RateLimitResult>;

  protected buildResult(
    allowed: boolean,
    remaining: number,
    total: number,
    resetAt: number,
    retryAfter?: number
  ): RateLimitResult {
    return {
      allowed,
      remaining: Math.max(0, remaining),
      total,
      resetAt,
      retryAfter: retryAfter ? Math.ceil(retryAfter / 1000) : undefined,
      algorithm: this.algorithm,
    };
  }
}
