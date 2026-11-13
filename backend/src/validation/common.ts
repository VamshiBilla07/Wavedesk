import { z } from 'zod';

/**
 * Normalizes phone numbers to E.164 digits without a leading '+'
 * e.g. "+1 (555) 123-4567" -> "15551234567"
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export const phoneSchema = z
  .string()
  .transform((val) => normalizePhone(val))
  .refine((val) => /^\d{10,15}$/.test(val), {
    message: 'Phone must be between 10 and 15 E.164 digits without leading +',
  });

export const idSchema = z.string().min(1, 'ID is required');

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((n) => !isNaN(n) && n > 0 && n <= 100, {
      message: 'Limit must be between 1 and 100',
    }),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
