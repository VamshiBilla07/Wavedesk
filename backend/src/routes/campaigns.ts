import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CampaignStatus, MessageStatus, Prisma, TemplateStatus } from '@prisma/client';
import { prisma } from '../services/database';
import { authenticate } from '../middleware/auth';
import { runCampaign } from '../services/whatsapp';
import { emitToCompany } from '../services/socket';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const audienceSchema = z.object({
  tagIds: z.array(z.string()).optional(),
  contactTypeIds: z.array(z.string()).optional(),
  customerIds: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(100),
  templateId: z.string().min(1),
  audience: audienceSchema,
  variableMap: z.record(z.string()).optional(),
});

/**
 * Resolves customer audience where clause from audience selector filters.
 */
function buildAudienceWhere(companyId: string, audience: z.infer<typeof audienceSchema>): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {
    companyId,
    optedOut: false, // Never send campaigns to opted-out customers
  };

  const conditions: Prisma.CustomerWhereInput[] = [];

  if (audience.customerIds && audience.customerIds.length > 0) {
    conditions.push({ id: { in: audience.customerIds } });
  }

  if (audience.tagIds && audience.tagIds.length > 0) {
    conditions.push({ tags: { some: { id: { in: audience.tagIds } } } });
  }

  if (audience.contactTypeIds && audience.contactTypeIds.length > 0) {
    conditions.push({ contactTypeId: { in: audience.contactTypeIds } });
  }

  if (conditions.length > 0) {
    where.OR = conditions;
  }

  return where;
}

/**
 * GET /api/campaigns
 * Lists campaigns with recipient progress counters.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const campaigns = await prisma.campaign.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            language: true,
            category: true,
            status: true,
          },
        },
        _count: {
          select: { recipients: true },
        },
      },
    });

    // Compute progress stats for each campaign
    const enhancedCampaigns = await Promise.all(
      campaigns.map(async (camp) => {
        const stats = await prisma.campaignRecipient.groupBy({
          by: ['status'],
          where: { campaignId: camp.id },
          _count: { status: true },
        });

        let sent = 0;
        let delivered = 0;
        let read = 0;
        let failed = 0;

        for (const s of stats) {
          if (s.status === MessageStatus.SENT) sent = s._count.status;
          else if (s.status === MessageStatus.DELIVERED) delivered = s._count.status;
          else if (s.status === MessageStatus.READ) read = s._count.status;
          else if (s.status === MessageStatus.FAILED) failed = s._count.status;
        }

        return {
          ...camp,
          stats: {
            sent: sent + delivered + read,
            delivered: delivered + read,
            read,
            failed,
            total: camp.total || camp._count.recipients,
          },
        };
      })
    );

    res.status(200).json({ campaigns: enhancedCampaigns });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/campaigns/:id
 * Fetches campaign details and its recipients.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, companyId },
      include: {
        template: true,
        recipients: {
          include: {
            customer: {
              select: {
                id: true,
                phone: true,
                name: true,
                email: true,
              },
            },
          },
          take: 100,
        },
        _count: {
          select: { recipients: true },
        },
      },
    });

    if (!campaign) {
      throw new AppError('NOT_FOUND', 'Campaign not found', 404);
    }

    const stats = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { status: true },
    });

    let sent = 0;
    let delivered = 0;
    let read = 0;
    let failed = 0;

    for (const s of stats) {
      if (s.status === MessageStatus.SENT) sent = s._count.status;
      else if (s.status === MessageStatus.DELIVERED) delivered = s._count.status;
      else if (s.status === MessageStatus.READ) read = s._count.status;
      else if (s.status === MessageStatus.FAILED) failed = s._count.status;
    }

    res.status(200).json({
      campaign: {
        ...campaign,
        stats: {
          sent: sent + delivered + read,
          delivered: delivered + read,
          read,
          failed,
          total: campaign.total || campaign._count.recipients,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns
 * Creates a new campaign draft and computes audience count.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const input = createCampaignSchema.parse(req.body);

    const template = await prisma.template.findFirst({
      where: { id: input.templateId, companyId },
    });

    if (!template) {
      throw new AppError('NOT_FOUND', 'Template not found', 404);
    }

    // Calculate eligible audience count
    const where = buildAudienceWhere(companyId, input.audience);
    const audienceCount = await prisma.customer.count({ where });

    const campaign = await prisma.campaign.create({
      data: {
        companyId,
        templateId: input.templateId,
        name: input.name,
        status: CampaignStatus.DRAFT,
        audience: input.audience as Prisma.InputJsonValue,
        variableMap: input.variableMap ? (input.variableMap as Prisma.InputJsonValue) : Prisma.JsonNull,
        total: audienceCount,
      },
      include: {
        template: true,
      },
    });

    res.status(201).json({ campaign, audienceCount });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns/:id/send
 * Populates recipients and launches the background dispatch loop.
 */
router.post('/:id/send', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, companyId },
      include: { template: true },
    });

    if (!campaign) {
      throw new AppError('NOT_FOUND', 'Campaign not found', 404);
    }

    if (campaign.status === CampaignStatus.RUNNING) {
      throw new AppError('BAD_REQUEST', 'Campaign is already running', 400);
    }

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new AppError('BAD_REQUEST', 'Campaign has already completed', 400);
    }

    // Enforce that template is APPROVED by Meta
    if (campaign.template.status !== TemplateStatus.APPROVED) {
      throw new AppError(
        'TEMPLATE_NOT_APPROVED',
        `Cannot launch campaign with template "${campaign.template.name}" in status "${campaign.template.status}". Template must be APPROVED by Meta.`,
        422
      );
    }

    // Populate recipients if not yet populated
    const existingRecipientsCount = await prisma.campaignRecipient.count({
      where: { campaignId },
    });

    if (existingRecipientsCount === 0) {
      const audience = (campaign.audience as z.infer<typeof audienceSchema>) || {};
      const where = buildAudienceWhere(companyId, audience);
      const eligibleCustomers = await prisma.customer.findMany({
        where,
        select: { id: true },
      });

      if (eligibleCustomers.length === 0) {
        throw new AppError('BAD_REQUEST', 'No eligible customers found in selected audience', 400);
      }

      await prisma.campaignRecipient.createMany({
        data: eligibleCustomers.map((c) => ({
          campaignId,
          customerId: c.id,
          status: MessageStatus.PENDING,
        })),
        skipDuplicates: true,
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { total: eligibleCustomers.length },
      });
    }

    // Set status to RUNNING
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.RUNNING,
        startedAt: campaign.startedAt || new Date(),
      },
    });

    // Start background sender loop asynchronously
    setImmediate(() => {
      runCampaign(campaignId).catch((err) => {
        console.error(`[Campaigns] Error running campaign ${campaignId}:`, err);
      });
    });

    emitToCompany(companyId, 'campaign:progress', {
      campaignId,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      total: updated.total,
    });

    res.status(200).json({ success: true, campaign: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns/:id/pause
 * Pauses a running campaign.
 */
router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, companyId },
    });

    if (!campaign) {
      throw new AppError('NOT_FOUND', 'Campaign not found', 404);
    }

    if (campaign.status !== CampaignStatus.RUNNING) {
      throw new AppError('BAD_REQUEST', 'Only running campaigns can be paused', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.PAUSED },
    });

    res.status(200).json({ success: true, campaign: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns/:id/resume
 * Resumes a paused campaign.
 */
router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, companyId },
    });

    if (!campaign) {
      throw new AppError('NOT_FOUND', 'Campaign not found', 404);
    }

    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new AppError('BAD_REQUEST', 'Only paused campaigns can be resumed', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.RUNNING },
    });

    setImmediate(() => {
      runCampaign(campaignId).catch((err) => {
        console.error(`[Campaigns] Error resuming campaign ${campaignId}:`, err);
      });
    });

    res.status(200).json({ success: true, campaign: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns/:id/cancel
 * Cancels a campaign.
 */
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, companyId },
    });

    if (!campaign) {
      throw new AppError('NOT_FOUND', 'Campaign not found', 404);
    }

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new AppError('BAD_REQUEST', 'Cannot cancel a completed campaign', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.CANCELLED },
    });

    res.status(200).json({ success: true, campaign: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
