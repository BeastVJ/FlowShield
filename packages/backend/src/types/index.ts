import { Request } from 'express';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum AlgorithmType {
  FIXED_WINDOW = 'FIXED_WINDOW',
  SLIDING_WINDOW = 'SLIDING_WINDOW',
  SLIDING_LOG = 'SLIDING_LOG',
  TOKEN_BUCKET = 'TOKEN_BUCKET',
  LEAKY_BUCKET = 'LEAKY_BUCKET',
}

export enum ProjectPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export interface RateLimitConfig {
  algorithm: AlgorithmType;
  maxRequests: number;
  windowMs: number;
  burstCapacity?: number;
  refillRate?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  total: number;
  resetAt: number;
  retryAfter?: number;
  algorithm: AlgorithmType;
}

export interface RateLimitKey {
  projectId: string;
  identifier: string;
}

export interface RedisRateLimitState {
  count: number;
  timestamps: number[];
  tokens: number;
  lastRefill: number;
  queue: number[];
}

export interface AnalyticsData {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  avgLatency: number;
  currentRPS: number;
  topIdentifiers: Array<{ identifier: string; count: number }>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
}

export interface WebSocketMetrics {
  projectId: string;
  timestamp: number;
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  currentRPS: number;
  activeConnections: number;
}

export interface AuditLogEntry {
  action: string;
  userId: string;
  projectId?: string;
  apiKeyId?: string;
  details: Record<string, unknown>;
  ip: string;
  userAgent: string;
  timestamp: Date;
}
