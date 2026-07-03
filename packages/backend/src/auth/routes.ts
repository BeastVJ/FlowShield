import { Router, Response } from 'express';
import { AuthService } from './service';
import { authenticate } from './middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from './validation';
import { AuthRequest } from '../types';

const router = Router();
const authService = new AuthService();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email already registered
 */
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const input = registerSchema.parse(req.body);
    const ip = req.ip;
    const result = await authService.register(input, ip);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    if (err.statusCode) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 */
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const input = loginSchema.parse(req.body);
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const result = await authService.login(input, ip, userAgent);

    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    if (err.statusCode) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 */
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const input = refreshTokenSchema.parse(req.body);
    const tokens = await authService.refresh(input.refreshToken);

    res.json({
      success: true,
      message: 'Token refreshed',
      data: tokens,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    if (err.statusCode) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout (revoke refresh token)
 */
router.post('/logout', async (req: AuthRequest, res: Response) => {
  try {
    const input = refreshTokenSchema.parse(req.body);
    await authService.logout(input.refreshToken);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Logout from all devices
 */
router.post('/logout-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await authService.logoutAll(req.user!.id);

    res.json({
      success: true,
      message: `Revoked ${result.revoked} session(s)`,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password
 */
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, input, req.ip);

    res.json({
      success: true,
      message: 'Password changed successfully. All other sessions have been revoked.',
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    if (err.statusCode) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: { user: req.user },
  });
});

export default router;
