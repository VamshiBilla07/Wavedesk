import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../services/database';
import { authenticate, requireRole } from '../middleware/auth';
import { encrypt, mask, decrypt } from '../services/encryption';
import { verifyCredentials } from '../services/whatsapp';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const updateCompanySchema = z.object({
  name: z.string().trim().min(2, 'Company name must be at least 2 characters').max(100),
});

const updateWhatsappSchema = z.object({
  phoneNumberId: z.string().trim().min(1, 'Phone Number ID is required'),
  wabaId: z.string().trim().min(1, 'WABA ID is required'),
  accessToken: z.string().trim().min(1, 'Access Token is required'),
  appSecret: z.string().trim().min(1, 'App Secret is required'),
});

const createUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8),
  role: z.enum([Role.ADMIN, Role.AGENT]).default(Role.AGENT),
});

/**
 * GET /api/settings/company
 */
router.get('/company', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.user!.companyId },
    });

    if (!company) {
      throw new AppError('NOT_FOUND', 'Company not found', 404);
    }

    let maskedToken = '';
    if (company.encAccessToken) {
      try {
        const decrypted = decrypt(company.encAccessToken);
        maskedToken = mask(decrypted);
      } catch {
        maskedToken = '••••••••';
      }
    }

    res.status(200).json({
      company: {
        id: company.id,
        name: company.name,
        phoneNumberId: company.phoneNumberId,
        wabaId: company.wabaId,
        hasAccessToken: Boolean(company.encAccessToken),
        maskedAccessToken: maskedToken,
        hasAppSecret: Boolean(company.encAppSecret),
        createdAt: company.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings/company
 */
router.put(
  '/company',
  requireRole(Role.OWNER, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = updateCompanySchema.parse(req.body);
      const company = await prisma.company.update({
        where: { id: req.user!.companyId },
        data: { name: input.name },
      });

      res.status(200).json({ company: { id: company.id, name: company.name } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/settings/whatsapp
 * Encrypts sensitive credentials before persisting.
 */
router.put(
  '/whatsapp',
  requireRole(Role.OWNER, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = updateWhatsappSchema.parse(req.body);

      const encAccessToken = encrypt(input.accessToken);
      const encAppSecret = encrypt(input.appSecret);

      const company = await prisma.company.update({
        where: { id: req.user!.companyId },
        data: {
          phoneNumberId: input.phoneNumberId,
          wabaId: input.wabaId,
          encAccessToken,
          encAppSecret,
        },
      });

      res.status(200).json({
        success: true,
        company: {
          id: company.id,
          phoneNumberId: company.phoneNumberId,
          wabaId: company.wabaId,
          maskedAccessToken: mask(input.accessToken),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/settings/whatsapp/test
 * Tests provided or saved WhatsApp credentials.
 */
router.post(
  '/whatsapp/test',
  requireRole(Role.OWNER, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let phoneNumberId = req.body?.phoneNumberId;
      let accessToken = req.body?.accessToken;

      if (!phoneNumberId || !accessToken) {
        const company = await prisma.company.findUnique({
          where: { id: req.user!.companyId },
        });

        if (!company || !company.phoneNumberId || !company.encAccessToken) {
          throw new AppError('BAD_REQUEST', 'No WhatsApp credentials configured to test', 400);
        }

        phoneNumberId = company.phoneNumberId;
        accessToken = decrypt(company.encAccessToken);
      }

      const result = await verifyCredentials(phoneNumberId, accessToken);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/settings/webhook
 * Returns webhook endpoint URL and verify token.
 */
router.get('/webhook', (_req: Request, res: Response): void => {
  const host = process.env.API_BASE_URL || 'http://localhost:4000';
  const webhookUrl = `${host}/api/webhooks/whatsapp`;
  const verifyToken = process.env.META_VERIFY_TOKEN || 'wavedesk_verify_token_123';

  res.status(200).json({
    webhookUrl,
    verifyToken,
  });
});

/**
 * GET /api/settings/users
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.user!.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/settings/users
 */
router.post(
  '/users',
  requireRole(Role.OWNER, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = createUserSchema.parse(req.body);

      const existing = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existing) {
        throw new AppError('CONFLICT', 'A user with this email already exists', 409);
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const user = await prisma.user.create({
        data: {
          companyId: req.user!.companyId,
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/settings/users/:id
 */
router.delete(
  '/users/:id',
  requireRole(Role.OWNER, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetUserId = req.params.id;

      if (targetUserId === req.user!.id) {
        throw new AppError('BAD_REQUEST', 'You cannot delete your own account', 400);
      }

      const targetUser = await prisma.user.findFirst({
        where: { id: targetUserId, companyId: req.user!.companyId },
      });

      if (!targetUser) {
        throw new AppError('NOT_FOUND', 'User not found in your company', 404);
      }

      if (targetUser.role === Role.OWNER) {
        throw new AppError('FORBIDDEN', 'Cannot delete company OWNER account', 403);
      }

      await prisma.user.delete({
        where: { id: targetUserId },
      });

      res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
