import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import prisma from '../config/database';
import { config } from '../config';
import { logger } from '../config/logger';
import { UserPayload } from '../types';
import { UserRole as PrismaUserRole } from '@prisma/client';
import {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
} from './validation';

export class AuthService {
  /**
   * Register a new user with email, password, and name.
   */
  async register(input: RegisterInput, ip?: string) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, config.bcrypt.rounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.name, user.role);

    // Audit log
    await this.auditLog(user.id, 'USER_REGISTER', { email: user.email }, ip);

    logger.info('User registered', { userId: user.id, email: user.email });

    return { user, ...tokens };
  }

  /**
   * Login with email and password. Returns tokens.
   */
  async login(input: LoginInput, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.name,
      user.role,
      userAgent
    );

    // Audit log
    await this.auditLog(user.id, 'USER_LOGIN', { email: user.email }, ip);

    logger.info('User logged in', { userId: user.id });

    const { passwordHash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, ...tokens };
  }

  /**
   * Refresh access token using a valid refresh token.
   */
  async refresh(refreshToken: string) {
    // Verify refresh token exists and is not expired
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      // Clean up expired token if it exists
      if (stored) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Rotate: delete old refresh token, issue new pair
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokens(
      stored.user.id,
      stored.user.email,
      stored.user.name,
      stored.user.role,
      stored.userAgent || undefined
    );

    return tokens;
  }

  /**
   * Logout: revoke the refresh token.
   */
  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
    logger.info('User logged out');
  }

  /**
   * Logout from all sessions: revoke all refresh tokens for a user.
   */
  async logoutAll(userId: string) {
    const count = await prisma.refreshToken.deleteMany({
      where: { userId },
    });
    logger.info('All sessions revoked', { userId, count: count.count });
    return { revoked: count.count };
  }

  /**
   * Change password (requires current password).
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    ip?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError('Current password is incorrect', 401);
    }

    const newHash = await bcrypt.hash(input.newPassword, config.bcrypt.rounds);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all other sessions
    await prisma.refreshToken.deleteMany({ where: { userId } });

    await this.auditLog(userId, 'USER_LOGIN', { action: 'password_changed' }, ip);
    logger.info('Password changed', { userId });
  }

  /**
   * Generate access + refresh token pair.
   */
  private async generateTokens(
    userId: string,
    email: string,
    name: string,
    role: PrismaUserRole,
    userAgent?: string
  ) {
    const payload: UserPayload = { id: userId, email, name, role: role as unknown as import('../types').UserRole };

    const accessToken = jwt.sign(payload as object, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    // Generate refresh token
    const refreshToken = nanoid(64);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        userAgent,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Create an audit log entry.
   */
  private async auditLog(
    userId: string,
    action: string,
    details: Record<string, unknown>,
    ip?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          action: action as any,
          userId,
          details: details as any,
          ipAddress: ip,
        },
      });
    } catch (err) {
      logger.error('Failed to create audit log', { error: (err as Error).message });
    }
  }
}

/**
 * Custom application error with HTTP status code.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}
