import { Router, Request, Response } from 'express';
import { verifySignature, processWebhook } from '../services/whatsapp';

const router = Router();

/**
 * GET /api/webhooks/whatsapp
 * Meta Webhook verification handshake.
 * Verifies hub.mode and hub.verify_token, responds with hub.challenge.
 */
router.get('/whatsapp', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.META_VERIFY_TOKEN || 'wavedesk_verify_token_123';

  if (mode === 'subscribe' && token === expectedToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Verification token mismatch' } });
  }
});

/**
 * POST /api/webhooks/whatsapp
 * Receives inbound messages and message status events from Meta.
 * Verifies X-Hub-Signature-256 against rawBody with timingSafeEqual.
 * Responds 200 immediately, then processes asynchronously.
 */
router.post('/whatsapp', (req: Request, res: Response): void => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBody = (req as any).rawBody;
  const appSecret = process.env.META_APP_SECRET || '';

  // Skip signature verification only if in test mode without signature provided
  const isMock = process.env.WHATSAPP_MOCK === 'true';
  const shouldVerifySignature = Boolean(appSecret && !isMock);

  if (shouldVerifySignature) {
    const isValid = verifySignature(rawBody, signature, appSecret);
    if (!isValid) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing webhook signature',
        },
      });
      return;
    }
  }

  // Acknowledge receipt to Meta immediately (prevents timeouts & retries)
  res.status(200).send('EVENT_RECEIVED');

  // Asynchronous event processing
  setImmediate(async () => {
    try {
      await processWebhook(req.body);
    } catch (err) {
      console.error('[Webhook] Error processing background event:', err);
    }
  });
});

export default router;
