import Redis from 'ioredis';

// Mock Redis for unit tests
jest.mock('ioredis', () => {
  const store = new Map<string, string>();
  const hashStore = new Map<string, Record<string, string>>();
  const sortedSetStore = new Map<string, Map<string, number>>();

  const mockRedis = {
    eval: jest.fn().mockImplementation(async (script: string, numKeys: number, ...args: string[]) => {
      // Simulate fixed window
      if (script.includes('INCR') && script.includes('PEXPIRE')) {
        const key = args[0];
        const max = parseInt(args[1]);
        const current = parseInt(store.get(key) || '0');
        if (current < max) {
          store.set(key, String(current + 1));
          return [1, max - current - 1, max, Date.now() + parseInt(args[2])];
        }
        return [0, 0, max, Date.now() + parseInt(args[2])];
      }
      return [1, 99, 100, Date.now() + 60000];
    }),
    get: jest.fn().mockImplementation((key: string) => store.get(key) || null),
    set: jest.fn().mockImplementation((key: string, val: string) => store.set(key, val)),
    del: jest.fn().mockImplementation((...keys: string[]) => keys.forEach((k) => store.delete(k))),
    incr: jest.fn().mockImplementation((key: string) => {
      const val = parseInt(store.get(key) || '0') + 1;
      store.set(key, String(val));
      return val;
    }),
    pexpire: jest.fn(),
    zadd: jest.fn(),
    zremrangebyscore: jest.fn(),
    zcard: jest.fn().mockResolvedValue(0),
    hmget: jest.fn().mockResolvedValue([null, null]),
    hmset: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn(),
    status: 'ready',
  };

  return { default: jest.fn(() => mockRedis), __esModule: true };
});

describe('Rate Limiter Algorithms', () => {
  let redis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    redis = new (require('ioredis'))();
  });

  describe('FixedWindowLimiter', () => {
    it('should allow requests within the limit', async () => {
      const { FixedWindowLimiter } = require('../rate-limiter/algorithms/fixed-window');
      const limiter = new FixedWindowLimiter(redis);

      const result = await limiter.check('test-key', {
        algorithm: 'FIXED_WINDOW' as any,
        maxRequests: 100,
        windowMs: 60000,
      });

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('resetAt');
      expect(result.algorithm).toBe('FIXED_WINDOW');
    });
  });

  describe('SlidingWindowLimiter', () => {
    it('should initialize with correct algorithm type', async () => {
      const { SlidingWindowLimiter } = require('../rate-limiter/algorithms/sliding-window');
      const limiter = new SlidingWindowLimiter(redis);
      expect(limiter.algorithm).toBe('SLIDING_WINDOW');
    });
  });

  describe('SlidingLogLimiter', () => {
    it('should initialize with correct algorithm type', async () => {
      const { SlidingLogLimiter } = require('../rate-limiter/algorithms/sliding-log');
      const limiter = new SlidingLogLimiter(redis);
      expect(limiter.algorithm).toBe('SLIDING_LOG');
    });
  });

  describe('TokenBucketLimiter', () => {
    it('should initialize with correct algorithm type', async () => {
      const { TokenBucketLimiter } = require('../rate-limiter/algorithms/token-bucket');
      const limiter = new TokenBucketLimiter(redis);
      expect(limiter.algorithm).toBe('TOKEN_BUCKET');
    });
  });

  describe('LeakyBucketLimiter', () => {
    it('should initialize with correct algorithm type', async () => {
      const { LeakyBucketLimiter } = require('../rate-limiter/algorithms/leaky-bucket');
      const limiter = new LeakyBucketLimiter(redis);
      expect(limiter.algorithm).toBe('LEAKY_BUCKET');
    });
  });
});

describe('Redis Key Manager', () => {
  it('should generate correct keys', () => {
    const { RedisKeyManager } = require('../rate-limiter/keys');
    const km = new RedisKeyManager('fs');

    const base = km.baseKey('proj1', 'user1');
    expect(base).toBe('fs:proj1:user1');

    const fw = km.fixedWindow('proj1', 'user1', 60000);
    expect(fw).toMatch(/^fs:proj1:user1:fw:\d+$/);

    const sl = km.slidingLog('proj1', 'user1');
    expect(sl).toBe('fs:proj1:user1:sl');

    const tb = km.tokenBucket('proj1', 'user1');
    expect(tb).toBe('fs:proj1:user1:tb');
  });
});

describe('Rate Limiter Orchestrator', () => {
  it('should check rate limits and return results', async () => {
    const { RateLimiterOrchestrator } = require('../rate-limiter/orchestrator');
    const orchestrator = new RateLimiterOrchestrator(redis);

    const result = await orchestrator.check('proj_123', '192.168.1.1', {
      algorithm: 'FIXED_WINDOW',
      maxRequests: 100,
      windowMs: 60000,
    });

    expect(result).toHaveProperty('allowed');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('algorithm');
  });

  it('should fail open when Redis errors', async () => {
    redis.eval.mockRejectedValueOnce(new Error('Redis down'));

    const { RateLimiterOrchestrator } = require('../rate-limiter/orchestrator');
    const orchestrator = new RateLimiterOrchestrator(redis);

    const result = await orchestrator.check('proj_123', 'user1', {
      algorithm: 'FIXED_WINDOW',
      maxRequests: 100,
      windowMs: 60000,
    });

    // Should fail open — allowed = true
    expect(result.allowed).toBe(true);
  });
});
