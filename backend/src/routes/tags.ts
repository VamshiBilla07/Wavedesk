import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../services/database';
import { authenticate } from '../middleware/auth';
import { getOrSet, invalidateCompany } from '../services/cache';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const tagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(50),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex code (e.g. #10B981)').optional(),
});

const assignTagsSchema = z.object({
  customerIds: z.array(z.string()).min(1, 'At least one customer ID is required'),
  addTagIds: z.array(z.string()).optional(),
  removeTagIds: z.array(z.string()).optional(),
});

/**
 * GET /api/tags
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const cacheKey = `co:${companyId}:tags:list`;

    const tags = await getOrSet(cacheKey, 120, () =>
      prisma.tag.findMany({
        where: { companyId },
        include: {
          _count: { select: { customers: true } },
        },
        orderBy: { name: 'asc' },
      })
    );

    res.status(200).json({ tags });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tags
 */
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const input = tagSchema.parse(req.body);

    const tag = await prisma.tag.create({
      data: {
        companyId,
        name: input.name,
        color: input.color || '#10B981',
      },
    });

    await invalidateCompany(companyId, 'tags');

    res.status(201).json({ tag });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/tags/:id
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = tagSchema.partial().parse(req.body);

    const existing = await prisma.tag.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Tag not found', 404);
    }

    const tag = await prisma.tag.update({
      where: { id: existing.id },
      data: input,
    });

    await invalidateCompany(req.user!.companyId, 'tags');

    res.status(200).json({ tag });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/tags/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.tag.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Tag not found', 404);
    }

    await prisma.tag.delete({
      where: { id: existing.id },
    });

    await invalidateCompany(req.user!.companyId, 'tags');

    res.status(200).json({ success: true, message: 'Tag deleted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tags/assign
 * Bulk assign or remove tags on multiple customers.
 */
router.post('/assign', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = assignTagsSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const customers = await prisma.customer.findMany({
      where: {
        id: { in: input.customerIds },
        companyId,
      },
      select: { id: true },
    });

    const validCustomerIds = customers.map((c) => c.id);

    // Apply additions and removals
    await prisma.$transaction(async (tx) => {
      for (const customerId of validCustomerIds) {
        if (input.addTagIds && input.addTagIds.length > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: {
              tags: {
                connect: input.addTagIds.map((id) => ({ id })),
              },
            },
          });
        }

        if (input.removeTagIds && input.removeTagIds.length > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: {
              tags: {
                disconnect: input.removeTagIds.map((id) => ({ id })),
              },
            },
          });
        }
      }
    });

    res.status(200).json({
      success: true,
      updatedCount: validCustomerIds.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
