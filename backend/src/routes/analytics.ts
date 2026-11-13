import { Router, Request, Response, NextFunction } from 'express';
import { Direction, MessageStatus } from '@prisma/client';
import { prisma } from '../services/database';
import { authenticate } from '../middleware/auth';
import { getCacheStats, getOrSet } from '../services/cache';

const router = Router();
router.use(authenticate);

/**
 * GET /api/analytics/summary
 * Returns aggregated CRM metrics, message delivery & read rates, and cache telemetry.
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const cacheKey = `co:${companyId}:analytics:summary`;

    const summary = await getOrSet(cacheKey, 60, async () => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // 1. Audience counts
      const [totalCustomers, optedOutCustomers, active24hWindows] = await Promise.all([
        prisma.customer.count({ where: { companyId } }),
        prisma.customer.count({ where: { companyId, optedOut: true } }),
        prisma.customer.count({
          where: {
            companyId,
            lastCustomerMessageAt: { gte: twentyFourHoursAgo },
            optedOut: false,
          },
        }),
      ]);

      // 2. Message volume and delivery rates
      const [inboundTotal, outboundTotal, statusBreakdown] = await Promise.all([
        prisma.message.count({ where: { companyId, direction: Direction.INBOUND } }),
        prisma.message.count({ where: { companyId, direction: Direction.OUTBOUND } }),
        prisma.message.groupBy({
          by: ['status'],
          where: { companyId, direction: Direction.OUTBOUND },
          _count: { status: true },
        }),
      ]);

      let sent = 0;
      let delivered = 0;
      let read = 0;
      let failed = 0;

      for (const item of statusBreakdown) {
        if (item.status === MessageStatus.SENT) sent = item._count.status;
        else if (item.status === MessageStatus.DELIVERED) delivered = item._count.status;
        else if (item.status === MessageStatus.READ) read = item._count.status;
        else if (item.status === MessageStatus.FAILED) failed = item._count.status;
      }

      const totalDispatched = sent + delivered + read + failed;
      const deliverySuccessCount = delivered + read;
      const deliveryRate = totalDispatched > 0 ? Number(((deliverySuccessCount / totalDispatched) * 100).toFixed(1)) : 0;
      const readRate = totalDispatched > 0 ? Number(((read / totalDispatched) * 100).toFixed(1)) : 0;
      const failureRate = totalDispatched > 0 ? Number(((failed / totalDispatched) * 100).toFixed(1)) : 0;

      // 3. Campaign statistics
      const [totalCampaigns, totalCampaignRecipients] = await Promise.all([
        prisma.campaign.count({ where: { companyId } }),
        prisma.campaignRecipient.count({ where: { campaign: { companyId } } }),
      ]);

      return {
        audience: {
          total: totalCustomers,
          optedOut: optedOutCustomers,
          active24hWindows,
        },
        messages: {
          inboundTotal,
          outboundTotal,
          total: inboundTotal + outboundTotal,
          deliveryRate,
          readRate,
          failureRate,
          counts: {
            sent,
            delivered,
            read,
            failed,
          },
        },
        campaigns: {
          totalCampaigns,
          totalRecipients: totalCampaignRecipients,
        },
        system: {
          cache: getCacheStats(),
        },
      };
    });

    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/timeseries
 * Returns daily inbound and outbound message volume for the past 14 days.
 */
router.get('/timeseries', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const cacheKey = `co:${companyId}:analytics:timeseries`;

    const timeseries = await getOrSet(cacheKey, 60, async () => {
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const messages = await prisma.message.findMany({
        where: {
          companyId,
          createdAt: { gte: fourteenDaysAgo },
        },
        select: {
          direction: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Group into daily buckets
      const dailyMap: Record<string, { date: string; inbound: number; outbound: number; total: number }> = {};

      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = d.toISOString().split('T')[0];
        dailyMap[dateKey] = { date: dateKey, inbound: 0, outbound: 0, total: 0 };
      }

      for (const msg of messages) {
        const dateKey = msg.createdAt.toISOString().split('T')[0];
        if (dailyMap[dateKey]) {
          if (msg.direction === Direction.INBOUND) {
            dailyMap[dateKey].inbound++;
          } else {
            dailyMap[dateKey].outbound++;
          }
          dailyMap[dateKey].total++;
        }
      }

      return Object.values(dailyMap);
    });

    res.status(200).json({ timeseries });
  } catch (err) {
    next(err);
  }
});

export default router;
