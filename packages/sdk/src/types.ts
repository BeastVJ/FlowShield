export interface FlowShieldConfig {
  /** API key obtained from the FlowShield dashboard */
  apiKey: string;
  /** FlowShield API endpoint (default: https://api.flowshield.dev) */
  endpoint?: string;
  /** Timeout in ms for rate limit checks (default: 1000) */
  timeout?: number;
  /** Mode: 'cloud' (API) or 'local' (Redis directly) */
  mode?: 'cloud' | 'local';
  /** Redis config for local mode */
  redis?: {
    host?: string;
    port?: number;
    password?: string;
  };
  /** Algorithm for local mode */
  algorithm?: string;
  /** Max requests for local mode */
  maxRequests?: number;
  /** Window in ms for local mode */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  total: number;
  resetAt: number;
  retryAfter?: number;
  algorithm: string;
}

export interface MiddlewareOptions {
  /** Custom identifier extractor (default: req.ip) */
  identifier?: (req: any) => string;
  /** Custom key name */
  keyPrefix?: string;
  /** Skip rate limiting for certain requests */
  skip?: (req: any) => boolean;
  /** Custom headers to set */
  headers?: boolean;
}
