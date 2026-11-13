import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MessageStatus } from '@prisma/client';
import {
  is24HourWindowOpen,
  canTransitionStatus,
  verifySignature,
  processWebhook,
} from './whatsapp';
import { prisma } from './database';

describe('WhatsApp Service Core Logic', () => {
  const testCompanyId = `comp_wa_${Date.now()}`;
  const testPhone = '15550001122';

  beforeAll(async () => {
    await prisma.company.create({
      data: {
        id: testCompanyId,
        name: 'WhatsApp Test Company',
        phoneNumberId: `phone_id_${Date.now()}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { companyId: testCompanyId } });
    await prisma.customer.deleteMany({ where: { companyId: testCompanyId } });
    await prisma.company.deleteMany({ where: { id: testCompanyId } });
  });

  describe('24-Hour Messaging Window Rule', () => {
    it('returns false when customer has never sent a message (null)', () => {
      expect(is24HourWindowOpen(null)).toBe(false);
      expect(is24HourWindowOpen(undefined)).toBe(false);
    });

    it('returns true when message was received within the last 24 hours', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(is24HourWindowOpen(twoHoursAgo)).toBe(true);
    });

    it('returns false when message was received more than 24 hours ago', () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      expect(is24HourWindowOpen(twentyFiveHoursAgo)).toBe(false);
    });
  });

  describe('Status Ordering Hierarchy', () => {
    it('allows progressive status transitions', () => {
      expect(canTransitionStatus(MessageStatus.PENDING, MessageStatus.SENT)).toBe(true);
      expect(canTransitionStatus(MessageStatus.SENT, MessageStatus.DELIVERED)).toBe(true);
      expect(canTransitionStatus(MessageStatus.DELIVERED, MessageStatus.READ)).toBe(true);
      expect(canTransitionStatus(MessageStatus.PENDING, MessageStatus.READ)).toBe(true);
    });

    it('prevents status downgrades', () => {
      // Late-arriving delivered event after customer read
      expect(canTransitionStatus(MessageStatus.READ, MessageStatus.DELIVERED)).toBe(false);
      expect(canTransitionStatus(MessageStatus.READ, MessageStatus.SENT)).toBe(false);
      expect(canTransitionStatus(MessageStatus.DELIVERED, MessageStatus.SENT)).toBe(false);
    });

    it('always allows transition to FAILED status', () => {
      expect(canTransitionStatus(MessageStatus.PENDING, MessageStatus.FAILED)).toBe(true);
      expect(canTransitionStatus(MessageStatus.SENT, MessageStatus.FAILED)).toBe(true);
      expect(canTransitionStatus(MessageStatus.DELIVERED, MessageStatus.FAILED)).toBe(true);
      expect(canTransitionStatus(MessageStatus.READ, MessageStatus.FAILED)).toBe(true);
    });
  });

  describe('Signature Verification', () => {
    const secret = 'test_secret_123';
    const body = '{"hello":"world"}';

    it('validates correct HMAC-SHA256 signature', () => {
      const crypto = require('crypto');
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      expect(verifySignature(body, `sha256=${sig}`, secret)).toBe(true);
    });

    it('rejects tampered body or signature', () => {
      const crypto = require('crypto');
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      expect(verifySignature('{"hello":"tampered"}', `sha256=${sig}`, secret)).toBe(false);
      expect(verifySignature(body, 'sha256=invalid', secret)).toBe(false);
      expect(verifySignature(body, undefined, secret)).toBe(false);
    });
  });

  describe('Inbound Idempotency', () => {
    it('processes duplicate waMessageId without creating duplicate rows', async () => {
      const waMessageId = `wamid.test_idempotent_${Date.now()}`;

      const payload = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { phone_number_id: 'mock_phone_id' },
                  contacts: [{ profile: { name: 'Idempotency Tester' }, wa_id: testPhone }],
                  messages: [
                    {
                      from: testPhone,
                      id: waMessageId,
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      text: { body: 'First attempt' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      // Process first time
      await processWebhook(payload);

      const countAfterFirst = await prisma.message.count({
        where: { waMessageId },
      });
      expect(countAfterFirst).toBe(1);

      // Process exact same webhook second time
      await processWebhook(payload);

      const countAfterSecond = await prisma.message.count({
        where: { waMessageId },
      });
      expect(countAfterSecond).toBe(1); // Idempotency check: exactly 1 record remains
    });
  });
});
