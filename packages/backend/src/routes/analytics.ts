import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate } from '../auth/middleware';
import { AuthRequest } from '../types';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/analytics/{projectId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Get analytics for a project over a time range
 */
router.get('/:projectId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { from, to, limit = '50' } = req.query;

    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: req.user!.id },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const fromDate = from ? new Date(from as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();

    // Get summary stats
    const [totalRequests, allowedRequests, blockedRequests] = await Promise.all([
      prisma.requestLog.count({
        where: { projectId, createdAt: { gte: fromDate, lte: toDate } },
      }),
      prisma.requestLog.count({
        where: { projectId, createdAt: { gte: fromDate, lte: toDate }, allowed: true },
      }),
      prisma.requestLog.count({
        where: { projectId, createdAt: { gte: fromDate, lte: toDate }, allowed: false },
      }),
    ]);

    // Get average latency
    const latencyResult = await prisma.requestLog.aggregate({
      where: { projectId, createdAt: { gte: fromDate, lte: toDate } },
      _avg: { latencyMs: true },
    });

    // Get hourly distribution (last 24 hours)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyLogs = await prisma.$queryRawUnsafe(`
      SELECT
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as count,
        COUNT(CASE WHEN allowed = true THEN 1 END) as allowed,
        COUNT(CASE WHEN allowed = false THEN 1 END) as blocked
      FROM request_logs
      WHERE project_id = $1 AND created_at >= $2
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, projectId, last24h);

    // Get top identifiers
    const topIdentifiers = await prisma.$queryRawUnsafe(`
      SELECT identifier, COUNT(*) as count
      FROM request_logs
      WHERE project_id = $1 AND created_at >= $2
      GROUP BY identifier
      ORDER BY count DESC
      LIMIT $3
    `, projectId, fromDate, parseInt(limit as string));

    // Get per-API-key breakdown
    const perKeyStats = await prisma.$queryRawUnsafe(`
      SELECT
        ak.name as key_name,
        ak.id as key_id,
        COUNT(*) as total,
        COUNT(CASE WHEN rl.allowed = true THEN 1 END) as allowed,
        COUNT(CASE WHEN rl.allowed = false THEN 1 END) as blocked
      FROM request_logs rl
      JOIN api_keys ak ON rl.api_key_id = ak.id
      WHERE rl.project_id = $1 AND rl.created_at >= $2
      GROUP BY ak.id, ak.name
      ORDER BY total DESC
      LIMIT 10
    `, projectId, fromDate);

    // Get algorithm distribution
    const algorithmStats = await prisma.$queryRawUnsafe(`
      SELECT
        p.algorithm,
        COUNT(*) as count
      FROM request_logs rl
      JOIN api_keys ak ON rl.api_key_id = ak.id
      JOIN policies p ON ak.id = p.api_key_id
      WHERE rl.project_id = $1 AND rl.created_at >= $2
      GROUP BY p.algorithm
    `, projectId, fromDate);

    res.json({
      success: true,
      data: {
        summary: {
          totalRequests,
          allowedRequests,
          blockedRequests,
          avgLatency: Math.round(latencyResult._avg.latencyMs || 0),
          rejectionRate: totalRequests > 0
            ? Math.round((blockedRequests / totalRequests) * 100 * 100) / 100
            : 0,
        },
        hourlyDistribution: hourlyLogs,
        topIdentifiers,
        perKeyStats,
        algorithmStats,
        timeRange: { from: fromDate, to: toDate },
      },
    });
  } catch (err) {
    logger.error('Failed to get analytics', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/analytics/{projectId}/realtime:
 *   get:
 *     tags: [Analytics]
 *     summary: Get real-time metrics for a project (last 60 seconds)
 */
router.get('/:projectId/realtime', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: req.user!.id },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const [total, allowed, blocked] = await Promise.all([
      prisma.requestLog.count({
        where: { projectId, createdAt: { gte: oneMinuteAgo } },
      }),
      prisma.requestLog.count({
        where: { projectId, createdAt: { gte: oneMinuteAgo }, allowed: true },
      }),
      prisma.requestLog.count({
        where: { projectId, createdAt: { gte: oneMinuteAgo }, allowed: false },
      }),
    ]);

    // Requests per second (approximate)
    const rps = Math.round(total / 60 * 10) / 10;

    // Get recent logs
    const recentLogs = await prisma.requestLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        identifier: true,
        method: true,
        path: true,
        statusCode: true,
        allowed: true,
        latencyMs: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        currentRPS: rps,
        totalRequests: total,
        allowedRequests: allowed,
        blockedRequests: blocked,
        recentLogs,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    logger.error('Failed to get realtime analytics', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/analytics/{projectId}/logs:
 *   get:
 *     tags: [Analytics]
 *     summary: Get paginated request logs with filtering
 */
router.get('/:projectId/logs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { page = '1', pageSize = '50', allowed, identifier, method } = req.query;

    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: req.user!.id },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = Math.min(parseInt(pageSize as string), 100);

    const where: any = { projectId };
    if (allowed !== undefined) where.allowed = allowed === 'true';
    if (identifier) where.identifier = { contains: identifier as string };
    if (method) where.method = method as string;

    const [logs, total] = await Promise.all([
      prisma.requestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.requestLog.count({ where }),
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
    logger.error('Failed to get logs', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
