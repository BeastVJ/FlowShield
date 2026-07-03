/**
 * FlowShield Redis Key Design
 *
 * Key naming convention:
 *   fs:{projectId}:{identifier}:{algorithm}:{window}
 *
 * Examples:
 *   fs:proj_abc:192.168.1.1:fw:1706745600      — Fixed Window
 *   fs:proj_abc:192.168.1.1:sw:current            — Sliding Window Counter
 *   fs:proj_abc:192.168.1.1:sl                     — Sliding Log (sorted set)
 *   fs:proj_abc:192.168.1.1:tb                     — Token Bucket
 *   fs:proj_abc:192.168.1.1:lb                     — Leaky Bucket
 *
 * TTL Strategy:
 *   Fixed Window: 2x windowMs (auto-cleanup)
 *   Sliding Window Counter: 2x windowMs
 *   Sliding Log: windowMs (entries sorted by timestamp)
 *   Token Bucket: 3x (1/refillRate) for lazy cleanup
 *   Leaky Bucket: 3x windowMs
 */

export class RedisKeyManager {
  private readonly prefix: string;

  constructor(prefix: string = 'fs') {
    this.prefix = prefix;
  }

  /** Build the base key for a rate limit entry */
  baseKey(projectId: string, identifier: string): string {
    return `${this.prefix}:${projectId}:${identifier}`;
  }

  /** Fixed Window: key includes the window timestamp */
  fixedWindow(projectId: string, identifier: string, windowMs: number): string {
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    return `${this.baseKey(projectId, identifier)}:fw:${windowStart}`;
  }

  /** Sliding Window Counter: current + previous window keys */
  slidingWindowCurrent(projectId: string, identifier: string, windowMs: number): string {
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    return `${this.baseKey(projectId, identifier)}:sw:${windowStart}`;
  }

  slidingWindowPrevious(projectId: string, identifier: string, windowMs: number): string {
    const prevWindowStart = Math.floor(Date.now() / windowMs) * windowMs - windowMs;
    return `${this.baseKey(projectId, identifier)}:sw:${prevWindowStart}`;
  }

  /** Sliding Log: sorted set key */
  slidingLog(projectId: string, identifier: string): string {
    return `${this.baseKey(projectId, identifier)}:sl`;
  }

  /** Token Bucket: bucket state hash */
  tokenBucket(projectId: string, identifier: string): string {
    return `${this.baseKey(projectId, identifier)}:tb`;
  }

  /** Leaky Bucket: queue list key */
  leakyBucket(projectId: string, identifier: string): string {
    return `${this.baseKey(projectId, identifier)}:lb`;
  }

  /** Analytics counter key for a project */
  analyticsCounter(projectId: string, type: 'allowed' | 'blocked' | 'total'): string {
    return `${this.prefix}:analytics:${projectId}:${type}`;
  }

  /** Analytics RPS key (sorted set for sliding window RPS) */
  analyticsRPS(projectId: string): string {
    return `${this.prefix}:analytics:${projectId}:rps`;
  }

  /** All keys matching a project pattern */
  projectPattern(projectId: string): string {
    return `${this.prefix}:${projectId}:*`;
  }

  /** Cleanup old analytics keys */
  analyticsHourKey(projectId: string, hourTimestamp: number): string {
    return `${this.prefix}:analytics:${projectId}:hour:${hourTimestamp}`;
  }
}

export const keyManager = new RedisKeyManager();
