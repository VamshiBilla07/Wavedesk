import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Direction, MessageStatus, MessageType } from '@prisma/client';
import { prisma } from '../services/database';
import { authenticate } from '../middleware/auth';
import { is24HourWindowOpen, sendText, sendTemplate, sendMedia } from '../services/whatsapp';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const sendMessageSchema = z.object({
  type: z.enum([
    MessageType.TEXT,
    MessageType.TEMPLATE,
    MessageType.IMAGE,
    MessageType.DOCUMENT,
    MessageType.AUDIO,
    MessageType.VIDEO,
  ]).default(MessageType.TEXT),
  body: z.string().trim().optional(),
  templateName: z.string().trim().optional(),
  templateLanguage: z.string().default('en_US'),
  templateComponents: z.array(z.unknown()).optional(),
  mediaUrl: z.string().url().optional(),
});

/**
 * GET /api/messages/conversations
 * Returns customer conversation threads ordered by lastMessageAt with unread badge counts.
 */
router.get('/conversations', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const unreadOnly = req.query.unreadOnly === 'true';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const where: any = { companyId };
    if (unreadOnly) {
      where.unreadCount = { gt: 0 };
    }
    if (search) {
      const searchDigits = search.replace(/\D/g, '');
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        ...(searchDigits ? [{ phone: { contains: searchDigits } }] : []),
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: [
        { lastMessageAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 50,
      include: {
        contactType: true,
        tags: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const conversations = customers.map((c) => ({
      customer: {
        id: c.id,
        phone: c.phone,
        name: c.name,
        email: c.email,
        optedOut: c.optedOut,
        unreadCount: c.unreadCount,
        lastMessageAt: c.lastMessageAt,
        lastCustomerMessageAt: c.lastCustomerMessageAt,
        isWindowOpen: is24HourWindowOpen(c.lastCustomerMessageAt),
        contactType: c.contactType,
        tags: c.tags,
      },
      lastMessage: c.messages[0] || null,
    }));

    res.status(200).json({ conversations });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/messages/:customerId
 * Returns paginated message history and 24-hour window status for a customer.
 */
router.get('/:customerId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const customerId = req.params.customerId;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
      include: { contactType: true, tags: true },
    });

    if (!customer) {
      throw new AppError('NOT_FOUND', 'Customer not found', 404);
    }

    const messages = await prisma.message.findMany({
      where: { customerId, companyId },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        email: customer.email,
        optedOut: customer.optedOut,
        unreadCount: customer.unreadCount,
        lastCustomerMessageAt: customer.lastCustomerMessageAt,
        isWindowOpen: is24HourWindowOpen(customer.lastCustomerMessageAt),
        contactType: customer.contactType,
        tags: customer.tags,
      },
      messages,
      isWindowOpen: is24HourWindowOpen(customer.lastCustomerMessageAt),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/messages/:customerId
 * Outbound message flow:
 * - 24-hour rule check (rejects non-templates with 422 if window is closed)
 * - Inserts PENDING message
 * - Dispatches to WhatsApp Cloud API (or Mock)
 * - Updates status to SENT or FAILED
 */
router.post('/:customerId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const customerId = req.params.customerId;
    const input = sendMessageSchema.parse(req.body);

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });

    if (!customer) {
      throw new AppError('NOT_FOUND', 'Customer not found', 404);
    }

    if (customer.optedOut) {
      throw new AppError('BAD_REQUEST', 'Cannot message customer who has opted out', 400);
    }

    // 24-hour rule check: free-form text/media blocked if window closed
    const isWindowOpen = is24HourWindowOpen(customer.lastCustomerMessageAt);
    if (!isWindowOpen && input.type !== MessageType.TEMPLATE) {
      throw new AppError(
        'WINDOW_CLOSED',
        'The 24-hour customer messaging window is closed. You must send an approved template to re-engage this customer.',
        422
      );
    }

    if (input.type === MessageType.TEXT && !input.body) {
      throw new AppError('VALIDATION_ERROR', 'Message body is required for text messages', 400);
    }

    if (input.type === MessageType.TEMPLATE && !input.templateName) {
      throw new AppError('VALIDATION_ERROR', 'Template name is required for template messages', 400);
    }

    // 1. Insert message as PENDING
    const message = await prisma.message.create({
      data: {
        companyId,
        customerId,
        direction: Direction.OUTBOUND,
        type: input.type,
        body: input.body || null,
        templateName: input.templateName || null,
        mediaUrl: input.mediaUrl || null,
        status: MessageStatus.PENDING,
      },
    });

    // 2. Dispatch to WhatsApp Cloud API
    try {
      let sendResult: { waMessageId: string };

      if (input.type === MessageType.TEMPLATE) {
        sendResult = await sendTemplate({
          companyId,
          toPhone: customer.phone,
          templateName: input.templateName!,
          language: input.templateLanguage,
          components: input.templateComponents,
        });
      } else if (
        input.type === MessageType.IMAGE ||
        input.type === MessageType.DOCUMENT ||
        input.type === MessageType.AUDIO ||
        input.type === MessageType.VIDEO
      ) {
        const mediaType = input.type.toLowerCase() as 'image' | 'document' | 'audio' | 'video';
        sendResult = await sendMedia({
          companyId,
          toPhone: customer.phone,
          type: mediaType,
          mediaUrl: input.mediaUrl!,
          caption: input.body,
        });
      } else {
        sendResult = await sendText({
          companyId,
          toPhone: customer.phone,
          text: input.body!,
        });
      }

      // 3. Mark message as SENT
      const updatedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          waMessageId: sendResult.waMessageId,
          status: MessageStatus.SENT,
          sentAt: new Date(),
        },
      });

      // Update customer lastMessageAt
      await prisma.customer.update({
        where: { id: customerId },
        data: { lastMessageAt: new Date() },
      });

      res.status(201).json({ message: updatedMessage });
    } catch (sendErr) {
      // 4. Mark message as FAILED if send threw an error
      const errorMessage = sendErr instanceof Error ? sendErr.message : 'Failed to send message via WhatsApp';
      const errorCode = (sendErr as any)?.code || 'SEND_FAILED';

      const failedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.FAILED,
          errorCode,
          errorMessage,
        },
      });

      res.status(200).json({ message: failedMessage });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/messages/:customerId/read
 * Resets unread counter for a customer.
 */
router.post('/:customerId/read', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const customerId = req.params.customerId;

    await prisma.customer.updateMany({
      where: { id: customerId, companyId },
      data: { unreadCount: 0 },
    });

    res.status(200).json({ success: true, message: 'Conversation marked as read' });
  } catch (err) {
    next(err);
  }
});

export default router;
