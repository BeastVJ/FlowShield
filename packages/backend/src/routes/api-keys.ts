import { Router, Response } from 'express';
import { nanoid } from 'nanoid';
import prisma from '../config/database';
import { authenticate, extractIP, extractUserAgent } from '../auth/middleware';
import { AuthRequest } from '../types';
import { AlgorithmType as PrismaAlgorithmType } from '@prisma/client';
import { logger } from '../config/logger';
import { z } from 'zod';

const router = Router();

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  algorithm: z.nativeEnum(PrismaAlgorithmType).optional().default(PrismaAlgorithmType.FIXED_WINDOW),
  maxRequests: z.number().int().min(1).max(100000).optional().default(100),
  windowMs: z.number().int().min(1000).max(86400000).optional().default(60000),
  burstCapacity: z.number().int().min(1).max(100000).optional(),
  refillRate: z.number().min(0.1).max(100000).optional(),
});

const updatePolicySchema = z.object({
  algorithm: z.nativeEnum(PrismaAlgorithmType).optional(),
  maxRequests: z.number().int().min(1).max(100000).optional(),
  windowMs: z.number().int().min(1000).max(86400000).optional(),
  burstCapacity: z.number().int().min(1).max(100000).optional(),
  refillRate: z.number().min(0.1).max(100000).optional(),
});

/**
 * @swagger
 * /api/projects/{projectId}/keys:
 *   get:
 *     tags: [API Keys]
 *     summary: List all API keys for a project
 */
router.get('/:projectId/keys', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, ownerId: req.user!.id },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const keys = await prisma.apiKey.findMany({
      where: { projectId: req.params.projectId },
      include: { policy: true },
      orderBy: { createdAt: 'desc' },
    });

    // Mask the key in response
    const maskedKeys = keys.map((k: typeof keys[number]) => ({
      ...k,
      key: `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}`,
    }));

    res.json({ success: true, data: maskedKeys });
  } catch (err) {
    logger.error('Failed to list API keys', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/keys:
 *   post:
 *     tags: [API Keys]
 *     summary: Generate a new API key with rate limit policy
 */
router.post('/:projectId/keys', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, ownerId: req.user!.id },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Check key limit per project
    const keyCount = await prisma.apiKey.count({
      where: { projectId: req.params.projectId },
    });

    if (keyCount >= 20) {
      res.status(403).json({
        success: false,
        error: 'API key limit reached (max 20 per project)',
      });
      return;
    }

    const input = createApiKeySchema.parse(req.body);

    // Generate API key with prefix
    const apiKey = `fs_${nanoid(32)}`;

    // Create key + policy in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const key = await tx.apiKey.create({
        data: {
          key: apiKey,
          name: input.name,
          projectId: req.params.projectId,
        },
      });

      const policy = await tx.policy.create({
        data: {
          apiKeyId: key.id,
          algorithm: input.algorithm,
          maxRequests: input.maxRequests,
          windowMs: input.windowMs,
          burstCapacity: input.burstCapacity,
          refillRate: input.refillRate,
        },
      });

      return { ...key, policy };
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'APIKEY_CREATE' as any,
        userId: req.user!.id,
        projectId: req.params.projectId,
        apiKeyId: (result as any).id,
        details: { name: input.name, algorithm: input.algorithm } as any,
        ipAddress: extractIP(req),
        userAgent: extractUserAgent(req),
      },
    });

    logger.info('API key created', { keyId: result.id, projectId: req.params.projectId });

    // Return the FULL key only on creation
    res.status(201).json({
      success: true,
      data: {
        ...result,
        key: apiKey, // Only time the full key is returned
        _warning: 'Save this key now. It will not be shown again.',
      },
    });
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
 * /api/projects/{projectId}/keys/{keyId}:
 *   patch:
 *     tags: [API Keys]
 *     summary: Update the rate limit policy for an API key
 */
router.patch('/:projectId/keys/:keyId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Verify ownership
    const key = await prisma.apiKey.findFirst({
      where: { id: req.params.keyId, projectId: req.params.projectId },
      include: { project: true },
    });

    if (!key || key.project.ownerId !== req.user!.id) {
      res.status(404).json({ success: false, error: 'API key not found' });
      return;
    }

    const input = updatePolicySchema.parse(req.body);

    // Upsert policy
    const policy = await prisma.policy.upsert({
      where: { apiKeyId: key.id },
      create: {
        apiKeyId: key.id,
        algorithm: input.algorithm || PrismaAlgorithmType.FIXED_WINDOW,
        maxRequests: input.maxRequests || 100,
        windowMs: input.windowMs || 60000,
        burstCapacity: input.burstCapacity,
        refillRate: input.refillRate,
      },
      update: input,
    });

    res.json({ success: true, data: policy });
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
 * /api/projects/{projectId}/keys/{keyId}/rotate:
 *   post:
 *     tags: [API Keys]
 *     summary: Rotate an API key (generates new key, revokes old)
 */
router.post('/:projectId/keys/:keyId/rotate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const key = await prisma.apiKey.findFirst({
      where: { id: req.params.keyId, projectId: req.params.projectId },
      include: { project: true },
    });

    if (!key || key.project.ownerId !== req.user!.id) {
      res.status(404).json({ success: false, error: 'API key not found' });
      return;
    }

    const newApiKey = `fs_${nanoid(32)}`;

    const rotated = await prisma.$transaction(async (tx) => {
      // Revoke old key
      await tx.apiKey.update({
        where: { id: key.id },
        data: { status: 'REVOKED' },
      });

      // Create new key with same policy
      const newKey = await tx.apiKey.create({
        data: {
          key: newApiKey,
          name: `${key.name} (rotated)`,
          projectId: req.params.projectId,
        },
      });

      // Copy policy
      const oldPolicy = await tx.policy.findUnique({ where: { apiKeyId: key.id } });
      if (oldPolicy) {
        await tx.policy.create({
          data: {
            apiKeyId: newKey.id,
            algorithm: oldPolicy.algorithm,
            maxRequests: oldPolicy.maxRequests,
            windowMs: oldPolicy.windowMs,
            burstCapacity: oldPolicy.burstCapacity,
            refillRate: oldPolicy.refillRate,
          },
        });
      }

      return newKey;
    });

    await prisma.auditLog.create({
      data: {
        action: 'APIKEY_ROTATE' as any,
        userId: req.user!.id,
        projectId: req.params.projectId,
        apiKeyId: key.id,
        details: { oldKeyName: key.name } as any,
        ipAddress: extractIP(req),
        userAgent: extractUserAgent(req),
      },
    });

    logger.info('API key rotated', { oldKeyId: key.id, newKeyId: rotated.id });

    res.json({
      success: true,
      data: {
        ...rotated,
        key: newApiKey,
        _warning: 'Save this key now. It will not be shown again.',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/keys/{keyId}:
 *   delete:
 *     tags: [API Keys]
 *     summary: Revoke an API key
 */
router.delete('/:projectId/keys/:keyId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const key = await prisma.apiKey.findFirst({
      where: { id: req.params.keyId, projectId: req.params.projectId },
      include: { project: true },
    });

    if (!key || key.project.ownerId !== req.user!.id) {
      res.status(404).json({ success: false, error: 'API key not found' });
      return;
    }

    await prisma.apiKey.update({
      where: { id: key.id },
      data: { status: 'REVOKED' },
    });

    await prisma.auditLog.create({
      data: {
        action: 'APIKEY_REVOKE' as any,
        userId: req.user!.id,
        projectId: req.params.projectId,
        apiKeyId: key.id,
        details: { name: key.name } as any,
        ipAddress: extractIP(req),
        userAgent: extractUserAgent(req),
      },
    });

    logger.info('API key revoked', { keyId: key.id });

    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
