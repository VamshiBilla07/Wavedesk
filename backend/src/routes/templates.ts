import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TemplateCategory, TemplateStatus, Prisma } from '@prisma/client';
import { prisma } from '../services/database';
import { authenticate } from '../middleware/auth';
import { createTemplate, listTemplates } from '../services/whatsapp';
import { emitToCompany } from '../services/socket';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, 'Template name must contain only lowercase letters, digits, and underscores'),
  language: z.string().trim().default('en_US'),
  category: z.nativeEnum(TemplateCategory).default(TemplateCategory.MARKETING),
  components: z
    .array(z.record(z.unknown()))
    .min(1, 'At least one component (typically BODY) is required'),
});

/**
 * GET /api/templates
 * Lists templates for the current company.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const category = req.query.category as TemplateCategory | undefined;
    const status = req.query.status as TemplateStatus | undefined;

    const where: Prisma.TemplateWhereInput = { companyId };
    if (category && Object.values(TemplateCategory).includes(category)) {
      where.category = category;
    }
    if (status && Object.values(TemplateStatus).includes(status)) {
      where.status = status;
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ templates });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/templates/:id
 * Fetches a single template by ID.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const templateId = req.params.id;

    const template = await prisma.template.findFirst({
      where: { id: templateId, companyId },
    });

    if (!template) {
      throw new AppError('NOT_FOUND', 'Template not found', 404);
    }

    res.status(200).json({ template });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/templates
 * Creates a template in Wavedesk and submits to Meta WhatsApp Business API.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const input = createTemplateSchema.parse(req.body);

    const existing = await prisma.template.findUnique({
      where: {
        companyId_name_language: {
          companyId,
          name: input.name,
          language: input.language,
        },
      },
    });

    if (existing) {
      throw new AppError(
        'CONFLICT',
        `Template "${input.name}" with language "${input.language}" already exists`,
        409
      );
    }

    // 1. Submit template to Meta WhatsApp Cloud API
    const metaRes = await createTemplate({
      companyId,
      name: input.name,
      category: input.category,
      language: input.language,
      components: input.components,
    });

    let initialStatus: TemplateStatus = TemplateStatus.PENDING;
    if (metaRes.status === 'APPROVED') {
      initialStatus = TemplateStatus.APPROVED;
    } else if (metaRes.status === 'REJECTED') {
      initialStatus = TemplateStatus.REJECTED;
    } else if (metaRes.status === 'PAUSED') {
      initialStatus = TemplateStatus.PAUSED;
    }

    // 2. Persist template locally
    const template = await prisma.template.create({
      data: {
        companyId,
        metaId: metaRes.id,
        name: input.name,
        language: input.language,
        category: input.category,
        status: initialStatus,
        components: input.components as Prisma.InputJsonValue,
      },
    });

    emitToCompany(companyId, 'template:status', {
      templateId: template.id,
      status: template.status,
    });

    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/templates/:id
 * Deletes a template.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const templateId = req.params.id;

    const existing = await prisma.template.findFirst({
      where: { id: templateId, companyId },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Template not found', 404);
    }

    await prisma.template.delete({
      where: { id: templateId },
    });

    res.status(200).json({ success: true, message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/templates/sync
 * Syncs templates from Meta WhatsApp Business API.
 */
router.post('/sync', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const isMock = process.env.WHATSAPP_MOCK === 'true';

    // In mock mode, if no templates exist yet, seed standard pre-approved templates
    if (isMock) {
      const existingCount = await prisma.template.count({ where: { companyId } });
      if (existingCount === 0) {
        const mockTemplates = [
          {
            name: 'welcome_offer',
            category: TemplateCategory.MARKETING,
            language: 'en_US',
            status: TemplateStatus.APPROVED,
            components: [
              { type: 'HEADER', format: 'TEXT', text: 'Welcome to Wavedesk!' },
              {
                type: 'BODY',
                text: 'Hi {{1}}, welcome! Use code {{2}} to get 20% off your first order.',
              },
              { type: 'FOOTER', text: 'Reply STOP to opt out' },
              {
                type: 'BUTTONS',
                buttons: [{ type: 'QUICK_REPLY', text: 'Claim Discount' }],
              },
            ],
          },
          {
            name: 'appointment_reminder',
            category: TemplateCategory.UTILITY,
            language: 'en_US',
            status: TemplateStatus.APPROVED,
            components: [
              {
                type: 'BODY',
                text: 'Hello {{1}}, this is a reminder for your appointment scheduled on {{2}}.',
              },
              { type: 'FOOTER', text: 'Wavedesk Appointments' },
              {
                type: 'BUTTONS',
                buttons: [
                  { type: 'QUICK_REPLY', text: 'Confirm' },
                  { type: 'QUICK_REPLY', text: 'Reschedule' },
                ],
              },
            ],
          },
          {
            name: 'order_update',
            category: TemplateCategory.UTILITY,
            language: 'en_US',
            status: TemplateStatus.APPROVED,
            components: [
              {
                type: 'BODY',
                text: 'Hi {{1}}, your order #{{2}} has been shipped and is on its way!',
              },
              {
                type: 'BUTTONS',
                buttons: [{ type: 'QUICK_REPLY', text: 'Track Order' }],
              },
            ],
          },
        ];

        for (const tpl of mockTemplates) {
          await prisma.template.create({
            data: {
              companyId,
              name: tpl.name,
              category: tpl.category,
              language: tpl.language,
              status: tpl.status,
              components: tpl.components as Prisma.InputJsonValue,
              metaId: `mock_${tpl.name}_${Date.now()}`,
            },
          });
        }
      }
    } else {
      // In live mode, fetch from Meta Graph API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metaTemplates = (await listTemplates(companyId)) as any[];

      for (const item of metaTemplates) {
        if (!item.name) continue;

        let category: TemplateCategory = TemplateCategory.MARKETING;
        if (item.category === 'UTILITY') category = TemplateCategory.UTILITY;
        else if (item.category === 'AUTHENTICATION') category = TemplateCategory.AUTHENTICATION;

        let status: TemplateStatus = TemplateStatus.PENDING;
        if (item.status === 'APPROVED') status = TemplateStatus.APPROVED;
        else if (item.status === 'REJECTED') status = TemplateStatus.REJECTED;
        else if (item.status === 'PAUSED') status = TemplateStatus.PAUSED;

        await prisma.template.upsert({
          where: {
            companyId_name_language: {
              companyId,
              name: item.name,
              language: item.language || 'en_US',
            },
          },
          update: {
            metaId: item.id || null,
            category,
            status,
            components: (item.components || []) as Prisma.InputJsonValue,
            rejectReason: item.rejected_reason || null,
          },
          create: {
            companyId,
            metaId: item.id || null,
            name: item.name,
            language: item.language || 'en_US',
            category,
            status,
            components: (item.components || []) as Prisma.InputJsonValue,
            rejectReason: item.rejected_reason || null,
          },
        });
      }
    }

    const templates = await prisma.template.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      count: templates.length,
      templates,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
