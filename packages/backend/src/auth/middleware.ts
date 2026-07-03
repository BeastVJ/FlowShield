import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, UserPayload, UserRole } from '../types';

/**
 * JWT Authentication Middleware
 *
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches the decoded user payload to req.user.
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as UserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    } else {
      res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
  }
}

/**
 * Optional Authentication Middleware
 *
 * Extracts user from token if present, but does NOT require it.
 * Useful for endpoints that behave differently for authenticated vs anonymous users.
 */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as UserPayload;
      req.user = decoded;
    } catch {
      // Ignore invalid tokens — user stays undefined
    }
  }

  next();
}

/**
 * Role-Based Access Control (RBAC) Middleware Factory
 *
 * Creates middleware that checks if the authenticated user has one of the
 * allowed roles. Must be used after `authenticate`.
 *
 * Role hierarchy: ADMIN > MEMBER > VIEWER
 *
 * @example
 * router.delete('/projects/:id', authenticate, authorize('ADMIN'), deleteProject);
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * Extract client IP from request, considering proxies.
 */
export function extractIP(req: AuthRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.ip ||
    'unknown'
  );
}

/**
 * Extract User-Agent from request.
 */
export function extractUserAgent(req: AuthRequest): string {
  return (req.headers['user-agent'] as string) || 'unknown';
}
