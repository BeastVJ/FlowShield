import Redis from 'ioredis';
import { FlowShieldConfig, RateLimitResult, MiddlewareOptions } from './types';
import { FlowShieldMiddleware } from './middleware';

const LUA_FIXED_WINDOW = `
local key=KEYS[1]; local max=tonumber(ARGV[1]); local win=tonumber(ARGV[2]); local now=tonumber(ARGV[3])
local c=tonumber(redis.call('GET',key) or '0')
if c<max then local n=redis.call('INCR',key); if n==1 then redis.call('PEXPIRE',key,win) end
return {1,max-n,max,now+win} else local t=redis.call('PTTL',key); return {0,0,max,now+t} end`;

const LUA_TOKEN_BUCKET = `
local key=KEYS[1]; local cap=tonumber(ARGV[1]); local rate=tonumber(ARGV[2]); local win=tonumber(ARGV[3]); local now=tonumber(ARGV[4])
local b=redis.call('HMGET',key,'t','l'); local tokens=tonumber(b[1]); local last=tonumber(b[2])
if not tokens then tokens=cap; last=now end
local el=now-last; if el>0 then tokens=math.min(cap,tokens+el*(rate/win)); last=now end
if tokens>=1 then tokens=tokens-1; redis.call('HMSET',key,'t',tostring(tokens),'l',tostring(last)); redis.call('PEXPIRE',key,win*3)
return {1,math.floor(tokens),cap,now+math.ceil((cap-tokens)/(rate/win))} else
redis.call('HMSET',key,'t',tostring(tokens),'l',tostring(last)); redis.call('PEXPIRE',key,win*3)
return {0,math.floor(tokens),cap,now+math.ceil((1-tokens)/(rate/win)),math.ceil((1-tokens)/(rate/win))} end`;

export class FlowShieldLocal {
  private redis: Redis;
  private prefix: string;
  private maxRequests: number;
  private windowMs: number;
  private algorithm: string;

  constructor(config: FlowShieldConfig) {
    this.redis = new Redis({
      host: config.redis?.host || 'localhost',
      port: config.redis?.port || 6379,
      password: config.redis?.password,
    });
    this.prefix = 'fs_sdk';
    this.maxRequests = config.maxRequests || 100;
    this.windowMs = config.windowMs || 60000;
    this.algorithm = config.algorithm || 'FIXED_WINDOW';
  }

  async check(identifier: string): Promise<RateLimitResult> {
    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();

    let result: number[];
    if (this.algorithm === 'TOKEN_BUCKET') {
      result = await this.redis.eval(LUA_TOKEN_BUCKET, 1, key,
        this.maxRequests.toString(), this.maxRequests.toString(),
        this.windowMs.toString(), now.toString()) as number[];
    } else {
      result = await this.redis.eval(LUA_FIXED_WINDOW, 1, key,
        this.maxRequests.toString(), this.windowMs.toString(),
        now.toString()) as number[];
    }

    return {
      allowed: result[0] === 1,
      remaining: Math.max(0, result[1]),
      total: result[2],
      resetAt: result[3],
      retryAfter: result[4] ? Math.ceil(result[4] / 1000) : undefined,
      algorithm: this.algorithm,
    };
  }

  middleware(options?: MiddlewareOptions) {
    // Wrap this.localCheck as if it were a FlowShield client
    const self = this;
    const handler = async (req: any, res: any, next: any) => {
      try {
        if (options?.skip?.(req)) return next();
        const identifier = options?.identifier?.(req) || req.ip || 'unknown';
        const result = await self.check(identifier);

        res.set({
          'X-RateLimit-Limit': result.total.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetAt.toString(),
        });

        if (!result.allowed) {
          if (result.retryAfter) res.set('Retry-After', result.retryAfter.toString());
          return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: result.retryAfter });
        }
        next();
      } catch {
        next(); // Fail open
      }
    };
    return handler;
  }

  async disconnect() {
    await this.redis.quit();
  }
}
