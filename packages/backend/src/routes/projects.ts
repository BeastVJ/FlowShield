import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, authorize, extractIP, extractUserAgent } from '../auth/middleware';
import { AuthRequest, UserRole } from '../types';
import { logger } from '../config/logger';
import { z } from 'zod';

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
});

/**
 * @swagger
 * /api/projects:
 *   get:
 *     tags: [Projects]
 *     summary: List all projects for the authenticated user
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: { ownerId: req.user!.id },
      include: {
        _count: {
          select: { apiKeys: true, logs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: projects });
  } catch (err) {
    logger.error('Failed to list projects', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Get a single project by ID
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
      include: {
        apiKeys: {
          select: { id: true, name: true, status: true, lastUsedAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { logs: true } },
      },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    res.json({ success: true, data: project });
  } catch (err) {
    logger.error('Failed to get project', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const input = createProjectSchema.parse(req.body);

    // Check plan limits: FREE = 3 projects, STARTER = 10, PRO = 50, ENTERPRISE = unlimited
    const projectCount = await prisma.project.count({
      where: { ownerId: req.user!.id },
    });

    const limits: Record<string, number> = {
      FREE: 3,
      STARTER: 10,
      PRO: 50,
      ENTERPRISE: Infinity,
    };

    if (projectCount >= (limits[req.user!.role] || 3)) {
      res.status(403).json({
        success: false,
        error: 'Project limit reached for your plan. Please upgrade.',
      });
      return;
    }

    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        ownerId: req.user!.id,
      },
      include: {
        _count: { select: { apiKeys: true, logs: true } },
      },
    });

    // Audit log
    await createAuditLog(req.user!.id, 'PROJECT_CREATE', project.id, {
      name: project.name,
    }, req);

    logger.info('Project created', { projectId: project.id, name: project.name });

    res.status(201).json({ success: true, data: project });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Failed to create project', { error: err.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/projects/{id}:
 *   patch:
 *     tags: [Projects]
 *     summary: Update a project
 */
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const input = updateProjectSchema.parse(req.body);

    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: input,
    });

    await createAuditLog(req.user!.id, 'PROJECT_UPDATE', project.id, {
      changes: input,
    }, req);

    res.json({ success: true, data: project });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     tags: [Projects]
 *     summary: Delete a project and all associated data
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    await prisma.project.delete({ where: { id: req.params.id } });

    await createAuditLog(req.user!.id, 'PROJECT_DELETE', req.params.id, {
      name: existing.name,
    }, req);

    logger.info('Project deleted', { projectId: req.params.id });

    res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

async function createAuditLog(
  userId: string,
  action: string,
  projectId: string,
  details: Record<string, unknown>,
  req: AuthRequest
) {
  try {
    await prisma.auditLog.create({
      data: {
        action: action as any,
        userId,
        projectId,
        details: details as any,
        ipAddress: extractIP(req),
        userAgent: extractUserAgent(req),
      },
    });
  } catch (err) {
    logger.error('Failed to create audit log', { error: (err as Error).message });
  }
}

export default router;
