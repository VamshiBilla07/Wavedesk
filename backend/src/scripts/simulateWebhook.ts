import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_PORT = process.env.PORT || 4000;
const WEBHOOK_URL = `http://localhost:${API_PORT}/api/webhooks/whatsapp`;
const APP_SECRET = process.env.META_APP_SECRET || 'mock_app_secret';

async function main() {
  console.log('--- Wavedesk Webhook Simulator ---');
  console.log(`Target: ${WEBHOOK_URL}`);

  const customerPhone = '15559876543';
  const customerName = 'Sarah Jenkins';
  const waMessageId = `wamid.HBgL${Date.now()}==`;

  // Sample Meta WhatsApp Cloud API Inbound Message Payload
  const inboundPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15551234567',
                phone_number_id: 'mock_phone_number_id',
              },
              contacts: [
                {
                  profile: { name: customerName },
                  wa_id: customerPhone,
                },
              ],
              messages: [
                {
                  from: customerPhone,
                  id: waMessageId,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: {
                    body: 'Hello Wavedesk! I would like to inquire about your services.',
                  },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const rawBody = JSON.stringify(inboundPayload);
  const signature = crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');

  try {
    console.log(`\n1. Posting inbound message from +${customerPhone} (${customerName})...`);
    const res = await axios.post(WEBHOOK_URL, inboundPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${signature}`,
      },
    });

    console.log(`   Response: [${res.status}] ${res.data}`);
    console.log(`   Customer created/updated and 24-hour messaging window opened.`);
  } catch (err: any) {
    console.error('   Failed to post inbound message:', err.response?.data || err.message);
  }

  // Allow 1 second for async processing
  await new Promise((r) => setTimeout(r, 1000));

  // Simulate Status Update: DELIVERED
  const statusPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15551234567',
                phone_number_id: 'mock_phone_number_id',
              },
              statuses: [
                {
                  id: waMessageId,
                  status: 'delivered',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  recipient_id: customerPhone,
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const statusRawBody = JSON.stringify(statusPayload);
  const statusSig = crypto.createHmac('sha256', APP_SECRET).update(statusRawBody).digest('hex');

  try {
    console.log(`\n2. Posting status update [delivered] for waMessageId ${waMessageId}...`);
    const res2 = await axios.post(WEBHOOK_URL, statusPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${statusSig}`,
      },
    });
    console.log(`   Response: [${res2.status}] ${res2.data}`);
  } catch (err: any) {
    console.error('   Failed to post status update:', err.response?.data || err.message);
  }

  console.log('\nSimulation complete! Check your inbox to view the new conversation.');
}

main().catch(console.error);
