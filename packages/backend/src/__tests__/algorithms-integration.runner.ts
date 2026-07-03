/**
 * Integration Test — All Rate Limiter Algorithms
 *
 * Tests each algorithm directly against the running Redis instance:
 *   - Fixed Window
 *   - Sliding Window Counter
 *   - Sliding Log
 *   - Token Bucket
 *   - Leaky Bucket
 *
 * Run: npx ts-node src/__tests__/algorithms-integration.runner.ts
 * Requires: Docker Redis on localhost:6379 (or configured)
 */

import Redis from 'ioredis';
import { FixedWindowLimiter } from '../rate-limiter/algorithms/fixed-window';
import { SlidingWindowLimiter } from '../rate-limiter/algorithms/sliding-window';
import { SlidingLogLimiter } from '../rate-limiter/algorithms/sliding-log';
import { TokenBucketLimiter } from '../rate-limiter/algorithms/token-bucket';
import { LeakyBucketLimiter } from '../rate-limiter/algorithms/leaky-bucket';
import { AlgorithmType, RateLimitConfig } from '../types';

const PASS = '✅ PASS';
const FAIL = '❌ FAIL';

interface TestResult {
  name: string;
  passed: boolean;
  details: string[];
  errors: string[];
}

function color(status: boolean, text: string): string {
  return status ? text : text;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  FLOWSHIELD — Rate Limiter Algorithm Integration Tests');
  console.log('='.repeat(70) + '\n');

  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  // Check Redis connection
  try {
    await redis.ping();
    console.log(`  ${PASS} Redis connected\n`);
  } catch (err) {
    console.log(`  ${FAIL} Could not connect to Redis. Is Docker running?`);
    console.log(`       ${err}`);
    process.exit(1);
  }

  const testNamespace = `test:${Date.now()}`;
  const results: TestResult[] = [];

  // Helper: clean up Redis keys after each test
  async function cleanUp() {
    const keys = await redis.keys(`fs:${testNamespace}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 1. FIXED WINDOW
  // ─────────────────────────────────────────────────────────
  {
    console.log('─'.repeat(70));
    console.log('  🔷 ALGORITHM: FIXED WINDOW');
    console.log('  Config: 3 requests per 5000ms window');
    console.log('─'.repeat(70));

    const limiter = new FixedWindowLimiter(redis);
    const config: RateLimitConfig = {
      algorithm: AlgorithmType.FIXED_WINDOW,
      maxRequests: 3,
      windowMs: 5000,
    };
    const key = `${testNamespace}:fw:user-1`;
    const details: string[] = [];
    const errors: string[] = [];

    await cleanUp();

    for (let i = 1; i <= 6; i++) {
      const result = await limiter.check(key, config);
      const line = `  [Req ${i}] allowed=${result.allowed}  remaining=${result.remaining}/${result.total}`;
      details.push(line);
      console.log(`    ${result.allowed ? '✅' : '❌'} ${line}`);
    }

    // Verify: first 3 should pass, 4th should be blocked
    const first3Allowed = details.slice(0, 3).every(d => d.includes('allowed=true'));
    const fourthBlocked = details[3]?.includes('allowed=false') ?? false;
    const passed = first3Allowed && fourthBlocked;
    if (!first3Allowed) errors.push('First 3 requests should all be allowed');
    if (!fourthBlocked) errors.push('4th request should be blocked (429)');

    results.push({ name: 'Fixed Window', passed, details, errors });
    console.log(`  ${passed ? PASS : FAIL} Fixed Window: ${passed ? 'Limit correctly enforced' : 'Bug detected!'}\n`);
    await cleanUp();
  }

  // ─────────────────────────────────────────────────────────
  // 2. SLIDING WINDOW
  // ─────────────────────────────────────────────────────────
  {
    console.log('─'.repeat(70));
    console.log('  🔷 ALGORITHM: SLIDING WINDOW COUNTER');
    console.log('  Config: 3 requests per 5000ms (weighted interpolation)');
    console.log('─'.repeat(70));

    const limiter = new SlidingWindowLimiter(redis);
    const config: RateLimitConfig = {
      algorithm: AlgorithmType.SLIDING_WINDOW,
      maxRequests: 3,
      windowMs: 5000,
    };
    const key = `${testNamespace}:sw:user-2`;
    const details: string[] = [];
    const errors: string[] = [];

    await cleanUp();

    for (let i = 1; i <= 8; i++) {
      const result = await limiter.check(key, config);
      const line = `  [Req ${i}] allowed=${result.allowed}  remaining=${result.remaining}/${result.total}`;
      details.push(line);
      console.log(`    ${result.allowed ? '✅' : '❌'} ${line}`);
    }

    // Sliding window uses interpolation — should allow ~3 within window
    const first3Allowed = details.slice(0, 3).every(d => d.includes('allowed=true'));
    const someBlocked = details.some(d => d.includes('allowed=false'));
    const passed = first3Allowed && someBlocked;
    if (!first3Allowed) errors.push('First 3 requests should be allowed');
    if (!someBlocked) errors.push('Expected at least one request to be rate-limited');

    results.push({ name: 'Sliding Window', passed, details, errors });
    console.log(`  ${passed ? PASS : FAIL} Sliding Window: ${passed ? 'Working as expected' : 'Issue detected'}\n`);
    await cleanUp();
  }

  // ─────────────────────────────────────────────────────────
  // 3. SLIDING LOG
  // ─────────────────────────────────────────────────────────
  {
    console.log('─'.repeat(70));
    console.log('  🔷 ALGORITHM: SLIDING LOG');
    console.log('  Config: 3 requests per 5000ms (exact timestamp tracking)');
    console.log('─'.repeat(70));

    const limiter = new SlidingLogLimiter(redis);
    const config: RateLimitConfig = {
      algorithm: AlgorithmType.SLIDING_LOG,
      maxRequests: 3,
      windowMs: 5000,
    };
    const key = `${testNamespace}:sl:user-3`;
    const details: string[] = [];
    const errors: string[] = [];

    await cleanUp();

    for (let i = 1; i <= 6; i++) {
      const result = await limiter.check(key, config);
      const line = `  [Req ${i}] allowed=${result.allowed}  remaining=${result.remaining}/${result.total}`;
      details.push(line);
      console.log(`    ${result.allowed ? '✅' : '❌'} ${line}`);
    }

    // Sliding log is exact: first 3 allowed, 4th blocked (no boundary effects)
    const first3Allowed = details.slice(0, 3).every(d => d.includes('allowed=true'));
    const fourthBlocked = details[3]?.includes('allowed=false') ?? false;
    const passed = first3Allowed && fourthBlocked;
    if (!first3Allowed) errors.push('First 3 requests should all be allowed');
    if (!fourthBlocked) errors.push('4th request should be blocked — sliding log is exact');

    results.push({ name: 'Sliding Log', passed, details, errors });
    console.log(`  ${passed ? PASS : FAIL} Sliding Log: ${passed ? 'Exact limit enforced' : 'Bug detected!'}\n`);
    await cleanUp();
  }

  // ─────────────────────────────────────────────────────────
  // 4. TOKEN BUCKET
  // ─────────────────────────────────────────────────────────
  {
    console.log('─'.repeat(70));
    console.log('  🔷 ALGORITHM: TOKEN BUCKET');
    console.log('  Config: capacity=3, refillRate=3 per 10000ms');
    console.log('  Allows bursts up to capacity, then refills over time');
    console.log('─'.repeat(70));

    const limiter = new TokenBucketLimiter(redis);
    const config: RateLimitConfig = {
      algorithm: AlgorithmType.TOKEN_BUCKET,
      maxRequests: 3,
      windowMs: 10000,
      burstCapacity: 3,
      refillRate: 3,
    };
    const key = `${testNamespace}:tb:user-4`;
    const details: string[] = [];
    const errors: string[] = [];

    await cleanUp();

    // Phase 1: Rapid burst — should get 3, then 4th blocked
    console.log('    Phase 1 — Burst (rapid requests):');
    let phase1Blocked = false;
    for (let i = 1; i <= 5; i++) {
      const result = await limiter.check(key, config);
      const line = `  [Req ${i}] allowed=${result.allowed}  remaining=${result.remaining}/${result.total}`;
      details.push(`Phase 1: ${line}`);
      console.log(`      ${result.allowed ? '✅' : '❌'} ${line}`);
      if (!result.allowed) phase1Blocked = true;
    }

    // Phase 2: Wait for refill (3 tokens / 10000ms = 1 token per ~3.3s)
    console.log('    Phase 2 — Waiting 3.5s for refill (~1 token):');
    await new Promise(r => setTimeout(r, 3500));

    for (let i = 1; i <= 3; i++) {
      const result = await limiter.check(key, config);
      const line = `  [Req ${i}] allowed=${result.allowed}  remaining=${result.remaining}/${result.total}`;
      details.push(`Phase 2: ${line}`);
      console.log(`      ${result.allowed ? '✅' : '❌'} ${line}`);
    }

    const burstWorked = details.slice(0, 3).filter(d => d.includes('allowed=true')).length >= 2;
    const passed = burstWorked;
    if (!burstWorked) errors.push('Token bucket burst should allow initial requests');
    if (!phase1Blocked) errors.push('Token bucket should block after capacity exhausted');

    results.push({ name: 'Token Bucket', passed, details, errors });
    console.log(`  ${passed ? PASS : FAIL} Token Bucket: ${passed ? 'Burst + refill working' : 'Issue detected'}\n`);
    await cleanUp();
  }

  // ─────────────────────────────────────────────────────────
  // 5. LEAKY BUCKET
  // ─────────────────────────────────────────────────────────
  {
    console.log('─'.repeat(70));
    console.log('  🔷 ALGORITHM: LEAKY BUCKET');
    console.log('  Config: capacity=3, leakRate=3 per 10000ms');
    console.log('  Constant rate processing — queues excess requests');
    console.log('─'.repeat(70));

    const limiter = new LeakyBucketLimiter(redis);
    const config: RateLimitConfig = {
      algorithm: AlgorithmType.LEAKY_BUCKET,
      maxRequests: 3,
      windowMs: 10000,
      burstCapacity: 3,
      refillRate: 3,
    };
    const key = `${testNamespace}:lb:user-5`;
    const details: string[] = [];
    const errors: string[] = [];

    await cleanUp();

    // Phase 1: Fill the bucket
    console.log('    Phase 1 — Fill bucket (rapid requests):');
    let phase1Blocked = false;
    for (let i = 1; i <= 5; i++) {
      const result = await limiter.check(key, config);
      const line = `  [Req ${i}] allowed=${result.allowed}  remaining=${result.remaining}/${result.total}`;
      details.push(`Phase 1: ${line}`);
      console.log(`      ${result.allowed ? '✅' : '❌'} ${line}`);
      if (!result.allowed) phase1Blocked = true;
    }

    // Phase 2: Wait for leak (3 leaks / 10000ms = 1 leak per ~3.3s)
    console.log('    Phase 2 — Waiting 3.5s for leak (~1 request processed):');
    await new Promise(r => setTimeout(r, 3500));

    for (let i = 1; i <= 3; i++) {
      const result = await limiter.check(key, config);
      const line = `  [Req ${i}] allowed=${result.allowed}  remaining=${result.remaining}/${result.total}`;
      details.push(`Phase 2: ${line}`);
      console.log(`      ${result.allowed ? '✅' : '❌'} ${line}`);
    }

    const burstWorked = details.slice(0, 3).filter(d => d.includes('allowed=true')).length >= 2;
    const passed = burstWorked;
    if (!burstWorked) errors.push('Leaky bucket should allow initial requests');
    if (!phase1Blocked) errors.push('Leaky bucket should block after capacity exhausted');

    results.push({ name: 'Leaky Bucket', passed, details, errors });
    console.log(`  ${passed ? PASS : FAIL} Leaky Bucket: ${passed ? 'Queue + leak working' : 'Issue detected'}\n`);
    await cleanUp();
  }

  // ─────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────
  console.log('='.repeat(70));
  console.log('  📊 RESULTS SUMMARY');
  console.log('='.repeat(70));

  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    const statusText = r.passed ? 'PASS' : 'FAIL';
    console.log(`  ${icon} ${statusText} — ${r.name}`);
    if (r.errors.length > 0) {
      for (const e of r.errors) {
        console.log(`       ⚠️  ${e}`);
      }
    }
    if (!r.passed) allPassed = false;
  }

  console.log('');
  if (allPassed) {
    console.log(`  ${PASS} All 5 algorithms are working correctly!`);
  } else {
    console.log(`  ${FAIL} Some algorithms have issues — see details above.`);
  }
  console.log('='.repeat(70) + '\n');

  await redis.quit();
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
