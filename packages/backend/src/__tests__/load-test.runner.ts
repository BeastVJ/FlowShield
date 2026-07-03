/**
 * Load Test — All Rate Limiter Algorithms Under Concurrency
 *
 * Simulates multiple concurrent users hitting each algorithm.
 * Measures: throughput, latency, enforcement accuracy, burst handling.
 *
 * Run: npx ts-node src/__tests__/load-test.runner.ts
 * Requires: Docker Redis running on localhost:6379
 */

import Redis from 'ioredis';
import { FixedWindowLimiter } from '../rate-limiter/algorithms/fixed-window';
import { SlidingWindowLimiter } from '../rate-limiter/algorithms/sliding-window';
import { SlidingLogLimiter } from '../rate-limiter/algorithms/sliding-log';
import { TokenBucketLimiter } from '../rate-limiter/algorithms/token-bucket';
import { LeakyBucketLimiter } from '../rate-limiter/algorithms/leaky-bucket';
import { AlgorithmType, RateLimitConfig, RateLimitResult } from '../types';

const PASS = '✅';
const FAIL = '❌';

interface LoadTestConfig {
  algorithm: string;
  concurrentUsers: number;
  requestsPerUser: number;
  rateLimitConfig: RateLimitConfig;
  description: string;
}

interface LoadTestMetrics {
  algorithm: string;
  totalRequests: number;
  allowed: number;
  blocked: number;
  blockRate: number;
  totalDurationMs: number;
  throughputRPS: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  p95LatencyMs: number;
  errors: number;
  limitEnforced: boolean;        // Did the rate limiter actually block anyone?
  enforcementDelayMs: number;    // How many requests before first block?
}

function latencyPercentile(latencies: number[], p: number): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runLoadTest(
  redis: Redis,
  config: LoadTestConfig,
  getLimiter: (redis: Redis) => { check: (key: string, cfg: RateLimitConfig) => Promise<RateLimitResult> }
): Promise<LoadTestMetrics> {
  const { algorithm, concurrentUsers, requestsPerUser, rateLimitConfig } = config;
  const testNs = `load:${algorithm.toLowerCase()}:${Date.now()}`;
  const limiter = getLimiter(redis);

  // Create users with different identifiers
  const users = Array.from({ length: concurrentUsers }, (_, i) => `${testNs}:user-${i}`);

  let totalRequests = 0;
  let allowed = 0;
  let blocked = 0;
  let errors = 0;
  const latencies: number[] = [];
  let firstBlockIdx: number | null = null;
  let requestIdx = 0;

  console.log(`\n  🚀 Running ${algorithm}...`);

  // Clean up before test
  const existingKeys = await redis.keys(`fs:${testNs}:*`);
  if (existingKeys.length > 0) await redis.del(...existingKeys);

  const startTime = Date.now();

  // Run concurrent users — each sends their requests sequentially
  const userTasks = users.map((userKey) => async () => {
    for (let r = 0; r < requestsPerUser; r++) {
      const reqStart = Date.now();
      try {
        const result = await limiter.check(userKey, rateLimitConfig);
        const reqEnd = Date.now();
        latencies.push(reqEnd - reqStart);

        totalRequests++;
        requestIdx++;

        if (result.allowed) {
          allowed++;
        } else {
          blocked++;
          if (firstBlockIdx === null) firstBlockIdx = requestIdx;
        }
      } catch (err) {
        errors++;
        totalRequests++;
      }
    }
  });

  // Run all users concurrently with Promise.all
  await Promise.all(userTasks.map((fn) => fn()));

  const endTime = Date.now();
  const totalDurationMs = endTime - startTime;
  const throughputRPS = totalDurationMs > 0 ? Math.round((totalRequests / totalDurationMs) * 1000) : 0;
  const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const maxLatencyMs = latencies.length > 0 ? Math.max(...latencies) : 0;
  const minLatencyMs = latencies.length > 0 ? Math.min(...latencies) : 0;
  const p95LatencyMs = latencies.length > 0 ? latencyPercentile(latencies, 95) : 0;
  const blockRate = totalRequests > 0 ? Math.round((blocked / totalRequests) * 100) : 0;
  const limitEnforced = blocked > 0;
  const enforcementDelayMs = firstBlockIdx !== null ? firstBlockIdx : totalRequests;

  // Clean up
  const cleanupKeys = await redis.keys(`fs:${testNs}:*`);
  if (cleanupKeys.length > 0) await redis.del(...cleanupKeys);

  return {
    algorithm,
    totalRequests,
    allowed,
    blocked,
    blockRate,
    totalDurationMs,
    throughputRPS,
    avgLatencyMs,
    maxLatencyMs,
    minLatencyMs,
    p95LatencyMs,
    errors,
    limitEnforced,
    enforcementDelayMs,
  };
}

function printResults(results: LoadTestMetrics[]) {
  console.log('\n' + '='.repeat(100));
  console.log('  📊 LOAD TEST RESULTS — All Algorithms Under Concurrency');
  console.log('='.repeat(100));

  // Header
  console.log(
    `  ${'Algorithm'.padEnd(18)} ` +
    `${'Total'.padEnd(8)} ` +
    `${'Allowed'.padEnd(9)} ` +
    `${'Blocked'.padEnd(9)} ` +
    `${'Block%'.padEnd(7)} ` +
    `${'RPS'.padEnd(7)} ` +
    `${'Avg Lat'.padEnd(9)} ` +
    `${'P95 Lat'.padEnd(9)} ` +
    `${'Max Lat'.padEnd(9)} ` +
    `${'Enforced?'.padEnd(10)}`
  );
  console.log('-'.repeat(100));

  const sorted = [...results].sort((a, b) => b.throughputRPS - a.throughputRPS);

  for (const r of sorted) {
    const enforced = r.limitEnforced ? `${PASS} Yes` : `${FAIL} No`;
    console.log(
      `  ${r.algorithm.padEnd(18)} ` +
      `${String(r.totalRequests).padEnd(8)} ` +
      `${String(r.allowed).padEnd(9)} ` +
      `${String(r.blocked).padEnd(9)} ` +
      `${String(r.blockRate) + '%'.padEnd(6)} ` +
      `${String(r.throughputRPS).padEnd(7)} ` +
      `${String(r.avgLatencyMs) + 'ms'.padEnd(6)} ` +
      `${String(r.p95LatencyMs) + 'ms'.padEnd(6)} ` +
      `${String(r.maxLatencyMs) + 'ms'.padEnd(6)} ` +
      `${enforced.padEnd(10)}`
    );
  }

  console.log('-'.repeat(100));

  // Rankings
  const byRPS = [...sorted].sort((a, b) => b.throughputRPS - a.throughputRPS);
  const byLatency = [...sorted].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs);
  const byBlockRate = [...sorted].sort((a, b) => b.blockRate - a.blockRate);

  console.log('\n  🏆 PERFORMANCE RANKINGS');
  console.log('');
  console.log(`  Fastest (RPS):   ${byRPS[0]?.algorithm} (${byRPS[0]?.throughputRPS} req/s)`);
  console.log(`  Lowest Latency:  ${byLatency[0]?.algorithm} (${byLatency[0]?.avgLatencyMs}ms avg)`);
  console.log(`  Best Blocking:   ${byBlockRate[0]?.algorithm} (${byBlockRate[0]?.blockRate}% blocked)`);

  // Warnings
  const warnings: string[] = [];
  for (const r of results) {
    if (!r.limitEnforced) {
      warnings.push(`${r.algorithm}: Rate limit was NOT enforced — all requests passed through!`);
    }
    if (r.errors > 0) {
      warnings.push(`${r.algorithm}: ${r.errors} errors occurred`);
    }
    if (r.p95LatencyMs > 100) {
      warnings.push(`${r.algorithm}: High P95 latency (${r.p95LatencyMs}ms)`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n  ⚠️  WARNINGS');
    for (const w of warnings) {
      console.log(`    ${FAIL} ${w}`);
    }
  }

  console.log('='.repeat(100) + '\n');
}

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('  FLOWSHIELD — Rate Limiter Load Test');
  console.log('  Simulating concurrent users against all 5 algorithms');
  console.log('='.repeat(100));

  // Connect to Redis
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

  try {
    await redis.ping();
    console.log(`\n  ${PASS} Redis connected`);
  } catch (err) {
    console.log(`\n  ${FAIL} Could not connect to Redis. Is Docker running?`);
    process.exit(1);
  }

  // ====================================================================
  // TEST 1: BURST TEST — 50 concurrent users, 20 req each (rapid fire)
  // ====================================================================
  console.log('\n' + '─'.repeat(100));
  console.log('  🔥 TEST 1: BURST — 50 concurrent users × 20 rapid requests');
  console.log('  Limit: 10 req / 5000ms window');
  console.log('  Expected: Users should be limited after ~10 requests each');
  console.log('─'.repeat(100));

  const burstConfig: LoadTestConfig = {
    algorithm: 'BURST',
    concurrentUsers: 50,
    requestsPerUser: 20,
    rateLimitConfig: { algorithm: AlgorithmType.FIXED_WINDOW, maxRequests: 10, windowMs: 5000 },
    description: 'Burst test — 50 users × 20 req, limit 10/5s',
  };

  // ====================================================================
  // TEST 2: ALL ALGORITHMS — 100 concurrent users, 15 req each
  // ====================================================================
  console.log('\n' + '─'.repeat(100));
  console.log('  🔄 TEST 2: ALGORITHM COMPARISON — 100 concurrent users × 15 requests');
  console.log('  Limit: 5 req / 5000ms (same config for fair comparison)');
  console.log('─'.repeat(100));

  const algoConfig: Omit<LoadTestConfig, 'algorithm' | 'rateLimitConfig'> = {
    concurrentUsers: 100,
    requestsPerUser: 15,
    description: '100 users × 15 req, limit 5/5s',
  };

  const results: LoadTestMetrics[] = [];

  // Run burst test first
  const burstResult = await runLoadTest(
    redis,
    burstConfig,
    (r) => new FixedWindowLimiter(r)
  );
  results.push(burstResult);

  // Run each algorithm
  const algorithms: Array<{
    name: string;
    config: RateLimitConfig;
    factory: (redis: Redis) => { check: (key: string, cfg: RateLimitConfig) => Promise<RateLimitResult> };
  }> = [
    {
      name: 'Fixed Window',
      config: { algorithm: AlgorithmType.FIXED_WINDOW, maxRequests: 5, windowMs: 5000 },
      factory: (r) => new FixedWindowLimiter(r),
    },
    {
      name: 'Sliding Window',
      config: { algorithm: AlgorithmType.SLIDING_WINDOW, maxRequests: 5, windowMs: 5000 },
      factory: (r) => new SlidingWindowLimiter(r),
    },
    {
      name: 'Sliding Log',
      config: { algorithm: AlgorithmType.SLIDING_LOG, maxRequests: 5, windowMs: 5000 },
      factory: (r) => new SlidingLogLimiter(r),
    },
    {
      name: 'Token Bucket',
      config: {
        algorithm: AlgorithmType.TOKEN_BUCKET,
        maxRequests: 5,
        windowMs: 5000,
        burstCapacity: 5,
        refillRate: 5,
      },
      factory: (r) => new TokenBucketLimiter(r),
    },
    {
      name: 'Leaky Bucket',
      config: {
        algorithm: AlgorithmType.LEAKY_BUCKET,
        maxRequests: 5,
        windowMs: 5000,
        burstCapacity: 5,
        refillRate: 5,
      },
      factory: (r) => new LeakyBucketLimiter(r),
    },
  ];

  for (const algo of algorithms) {
    const result = await runLoadTest(redis, {
      ...algoConfig,
      algorithm: algo.name,
      rateLimitConfig: algo.config,
    }, algo.factory);
    results.push(result);
  }

  // Print results
  printResults(results);

  // ====================================================================
  // EXTRA: Redis memory usage
  // ====================================================================
  try {
    const info = await redis.info('memory');
    const usedMemory = info.match(/used_memory_human:([^\r\n]+)/)?.[1]?.trim() || 'N/A';
    const peakMemory = info.match(/used_memory_peak_human:([^\r\n]+)/)?.[1]?.trim() || 'N/A';
    console.log(`  💾 Redis Memory: ${usedMemory} (peak: ${peakMemory})`);
  } catch {
    // ignore
  }

  await redis.quit();
  console.log('\n  Load test complete.\n');
}

main().catch((err) => {
  console.error('Load test crashed:', err);
  process.exit(1);
});
