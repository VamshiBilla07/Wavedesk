import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server';

describe('Webhook Routes', () => {
  const secret = process.env.META_APP_SECRET || 'mock_app_secret';
  const verifyToken = process.env.META_VERIFY_TOKEN || 'wavedesk_verify_token_123';

  it('GET /api/webhooks/whatsapp verifies challenge successfully', async () => {
    const challenge = 'random_challenge_code_12345';
    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': verifyToken,
        'hub.challenge': challenge,
      });

    expect(res.status).toBe(200);
    expect(res.text).toBe(challenge);
  });

  it('GET /api/webhooks/whatsapp rejects token mismatch with 403', async () => {
    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': 'some_challenge',
      });

    expect(res.status).toBe(403);
  });

  it('POST /api/webhooks/whatsapp returns 200 on valid signed payload', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [],
    };
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', `sha256=${signature}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.text).toBe('EVENT_RECEIVED');
  });

  it('POST /api/webhooks/whatsapp rejects tampered signature with 401', async () => {
    const payload = { object: 'whatsapp_business_account', entry: [] };
    const invalidSignature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

    // Temporarily disable mock mode to enforce signature check
    const originalMock = process.env.WHATSAPP_MOCK;
    process.env.WHATSAPP_MOCK = 'false';

    try {
      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', invalidSignature)
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    } finally {
      process.env.WHATSAPP_MOCK = originalMock;
    }
  });
});
