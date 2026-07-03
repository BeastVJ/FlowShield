import axios, { AxiosInstance } from 'axios';
import { FlowShieldConfig, RateLimitResult } from './types';
import { FlowShieldMiddleware } from './middleware';

export class FlowShield {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: FlowShieldConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: config.endpoint || 'https://api.flowshield.dev',
      timeout: config.timeout || 1000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Check rate limit for a given identifier.
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const { data } = await this.client.post('/api/rate-limit/check', {
      key: this.apiKey,
      identifier,
    });
    return data.data;
  }

  /**
   * Get Express middleware for automatic rate limiting.
   */
  middleware(options?: { identifier?: (req: any) => string; skip?: (req: any) => boolean }) {
    return new FlowShieldMiddleware(this, options).handle;
  }
}
