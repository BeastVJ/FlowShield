import { Request, Response, NextFunction } from 'express';
import { FlowShield } from './client';
import { MiddlewareOptions } from './types';

export class FlowShieldMiddleware {
  private shield: FlowShield;
  private options: MiddlewareOptions;

  constructor(shield: FlowShield, options?: MiddlewareOptions) {
    this.shield = shield;
    this.options = {
      identifier: (req: Request) => (req.ip || req.socket.remoteAddress || 'unknown'),
      headers: true,
      ...options,
    };
  }

  handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip if configured
      if (this.options.skip?.(req)) {
        return next();
      }

      const identifier = this.options.identifier!(req);
      const result = await this.shield.check(identifier);

      // Set rate limit headers
      if (this.options.headers !== false) {
        res.set({
          'X-RateLimit-Limit': result.total.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetAt.toString(),
        });
      }

      if (!result.allowed) {
        if (result.retryAfter) {
          res.set('Retry-After', result.retryAfter.toString());
        }
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
        });
        return;
      }

      next();
    } catch (err) {
      // Fail open — allow request if SDK fails
      next();
    }
  };
}
