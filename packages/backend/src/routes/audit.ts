import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, authorize } from '../auth/middleware';
import { AuthRequest, UserRole } from '../types';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/audit:
 *   get:
 *     tags: [Audit]
 *     summary: Get audit logs for the current user (ADMIN/MEMBER only)
 */
router.get('/', authenticate, authorize(UserRole.ADMIN, UserRole.MEMBER), async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', pageSize = '50', action, projectId } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = Math.min(parseInt(pageSize as string), 100);

    const where: any = { userId: req.user!.id };
    if (action) where.action = action as string;
    if (projectId) where.projectId = projectId as string;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          action: true,
          projectId: true,
          apiKeyId: true,
          details: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page as string),
          pageSize: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (err) {
    logger.error('Failed to get audit logs', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
