import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../services/database';
import { authenticate } from '../middleware/auth';
import { normalizePhone, phoneSchema } from '../validation/common';
import { uploadCsv } from '../middleware/upload';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const createCustomerSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().toLowerCase().optional().or(z.literal('')),
  contactTypeId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  attributes: z.record(z.unknown()).optional(),
});

const updateCustomerSchema = z.object({
  phone: phoneSchema.optional(),
  name: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().toLowerCase().optional().nullable().or(z.literal('')),
  contactTypeId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  attributes: z.record(z.unknown()).optional().nullable(),
  optedOut: z.boolean().optional(),
});

/**
 * GET /api/customers
 * Filterable, searchable, cursor-paginated customer directory.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const tagId = typeof req.query.tagId === 'string' ? req.query.tagId : '';
    const contactTypeId = typeof req.query.contactTypeId === 'string' ? req.query.contactTypeId : '';
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

    const where: Prisma.CustomerWhereInput = {
      companyId,
    };

    if (search) {
      const searchDigits = search.replace(/\D/g, '');
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        ...(searchDigits ? [{ phone: { contains: searchDigits } }] : []),
      ];
    }

    if (contactTypeId) {
      where.contactTypeId = contactTypeId;
    }

    if (tagId) {
      where.tags = { some: { id: tagId } };
    }

    const customers = await prisma.customer.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        contactType: true,
        tags: true,
      },
    });

    let nextCursor: string | null = null;
    if (customers.length > limit) {
      const nextItem = customers.pop();
      nextCursor = nextItem?.id || null;
    }

    const total = await prisma.customer.count({ where });

    res.status(200).json({
      customers,
      nextCursor,
      total,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/customers
 */
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const input = createCustomerSchema.parse(req.body);

    const existing = await prisma.customer.findUnique({
      where: {
        companyId_phone: {
          companyId,
          phone: input.phone,
        },
      },
    });

    if (existing) {
      throw new AppError('CONFLICT', `Customer with phone +${input.phone} already exists`, 409);
    }

    const customer = await prisma.customer.create({
      data: {
        companyId,
        phone: input.phone,
        name: input.name || null,
        email: input.email || null,
        contactTypeId: input.contactTypeId || null,
        attributes: input.attributes ? (input.attributes as Prisma.InputJsonValue) : Prisma.JsonNull,
        tags: input.tagIds && input.tagIds.length > 0 ? { connect: input.tagIds.map((id) => ({ id })) } : undefined,
      },
      include: {
        contactType: true,
        tags: true,
      },
    });

    res.status(201).json({ customer });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/customers/:id
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const customerId = req.params.id;
    const input = updateCustomerSchema.parse(req.body);

    const existing = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Customer not found', 404);
    }

    const data: Prisma.CustomerUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.contactTypeId !== undefined ? { contactType: input.contactTypeId ? { connect: { id: input.contactTypeId } } : { disconnect: true } } : {}),
      ...(input.optedOut !== undefined ? { optedOut: input.optedOut } : {}),
      ...(input.attributes !== undefined ? { attributes: input.attributes ? (input.attributes as Prisma.InputJsonValue) : Prisma.JsonNull } : {}),
      ...(input.tagIds ? { tags: { set: input.tagIds.map((id) => ({ id })) } } : {}),
    };

    if (input.phone && input.phone !== existing.phone) {
      data.phone = input.phone;
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data,
      include: {
        contactType: true,
        tags: true,
      },
    });

    res.status(200).json({ customer });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/customers/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const customerId = req.params.id;

    const existing = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Customer not found', 404);
    }

    // Delete associated records first
    await prisma.message.deleteMany({ where: { customerId } });
    await prisma.campaignRecipient.deleteMany({ where: { customerId } });

    await prisma.customer.delete({
      where: { id: customerId },
    });

    res.status(200).json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/customers/import
 * CSV Import: parses CSV, validates row-by-row, normalizes phones, dedupes, and returns error report.
 */
router.post(
  '/import',
  uploadCsv.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file || !req.file.buffer) {
        throw new AppError('BAD_REQUEST', 'Please upload a CSV file', 400);
      }

      const companyId = req.user!.companyId;
      const csvContent = req.file.buffer.toString('utf8');
      const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      if (lines.length < 2) {
        throw new AppError('BAD_REQUEST', 'CSV file must have a header row and at least one data row', 400);
      }

      // Parse header row
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
      const phoneIndex = headers.findIndex((h) => h === 'phone' || h.includes('phone') || h === 'mobile');
      const nameIndex = headers.findIndex((h) => h === 'name' || h.includes('name'));
      const emailIndex = headers.findIndex((h) => h === 'email');

      if (phoneIndex === -1) {
        throw new AppError('BAD_REQUEST', 'CSV must contain a "phone" column header', 400);
      }

      const errors: Array<{ row: number; phone?: string; error: string }> = [];
      const validRows: Array<{ phone: string; name?: string; email?: string }> = [];
      const seenPhones = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const cells = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
        const rawPhone = cells[phoneIndex] || '';
        const rawName = nameIndex !== -1 ? cells[nameIndex] : '';
        const rawEmail = emailIndex !== -1 ? cells[emailIndex] : '';

        const normalized = normalizePhone(rawPhone);

        if (!normalized || normalized.length < 10 || normalized.length > 15) {
          errors.push({
            row: i + 1,
            phone: rawPhone,
            error: 'Invalid phone number (must be 10-15 digits)',
          });
          continue;
        }

        if (seenPhones.has(normalized)) {
          errors.push({
            row: i + 1,
            phone: rawPhone,
            error: 'Duplicate phone number within CSV file',
          });
          continue;
        }

        seenPhones.add(normalized);
        validRows.push({
          phone: normalized,
          name: rawName || undefined,
          email: rawEmail || undefined,
        });
      }

      // Upsert valid rows in batches
      let imported = 0;
      for (const row of validRows) {
        try {
          await prisma.customer.upsert({
            where: {
              companyId_phone: {
                companyId,
                phone: row.phone,
              },
            },
            update: {
              ...(row.name ? { name: row.name } : {}),
              ...(row.email ? { email: row.email } : {}),
            },
            create: {
              companyId,
              phone: row.phone,
              name: row.name || null,
              email: row.email || null,
            },
          });
          imported++;
        } catch (err) {
          errors.push({
            row: -1,
            phone: row.phone,
            error: err instanceof Error ? err.message : 'Database insertion error',
          });
        }
      }

      res.status(200).json({
        totalRows: lines.length - 1,
        imported,
        failed: errors.length,
        errors,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/customers/export
 * Downloads CSV of all company customers.
 */
router.get('/export', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const customers = await prisma.customer.findMany({
      where: { companyId },
      include: { contactType: true, tags: true },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Phone', 'Name', 'Email', 'ContactType', 'Tags', 'CreatedAt', 'LastCustomerMessageAt'];
    const rows = customers.map((c) => {
      const tagsStr = c.tags.map((t) => t.name).join(';');
      return [
        `"${c.phone}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${c.contactType?.name || ''}"`,
        `"${tagsStr}"`,
        `"${c.createdAt.toISOString()}"`,
        `"${c.lastCustomerMessageAt ? c.lastCustomerMessageAt.toISOString() : ''}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
});

export default router;
