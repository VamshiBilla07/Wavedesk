import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../services/database';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const contactTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex code (e.g. #25D366)').optional(),
});

/**
 * GET /api/contact-types
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const contactTypes = await prisma.contactType.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        _count: { select: { customers: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ contactTypes });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/contact-types
 */
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = contactTypeSchema.parse(req.body);

    const contactType = await prisma.contactType.create({
      data: {
        companyId: req.user!.companyId,
        name: input.name,
        color: input.color || '#3B82F6',
      },
    });

    res.status(201).json({ contactType });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/contact-types/:id
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = contactTypeSchema.partial().parse(req.body);

    const existing = await prisma.contactType.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Contact type not found', 404);
    }

    const contactType = await prisma.contactType.update({
      where: { id: existing.id },
      data: input,
    });

    res.status(200).json({ contactType });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/contact-types/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.contactType.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Contact type not found', 404);
    }

    // Unlink customers before deleting
    await prisma.customer.updateMany({
      where: { contactTypeId: existing.id, companyId: req.user!.companyId },
      data: { contactTypeId: null },
    });

    await prisma.contactType.delete({
      where: { id: existing.id },
    });

    res.status(200).json({ success: true, message: 'Contact type deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
