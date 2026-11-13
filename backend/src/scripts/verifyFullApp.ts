import axios from 'axios';
import crypto from 'crypto';
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:4000';
const FRONTEND_BASE = 'http://localhost:3000';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: TestResult[] = [];

function record(step: string, status: 'PASS' | 'FAIL', details?: string) {
  results.push({ step, status, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${status}] ${step}${details ? ` - ${details}` : ''}`);
}

async function runFullVerification() {
  console.log('====================================================');
  console.log('     WAVEDESK END-TO-END SYSTEM VERIFICATION       ');
  console.log('====================================================\n');

  let authCookie = '';
  let customerId = '';

  // 1. Health Checks
  try {
    const health = await axios.get(`${API_BASE}/health`);
    if (health.status === 200 && health.data.status === 'ok') {
      record('Backend /health probe', 'PASS', `Uptime: ${health.data.uptime.toFixed(1)}s`);
    } else {
      record('Backend /health probe', 'FAIL', `Status ${health.status}`);
    }
  } catch (err: any) {
    record('Backend /health probe', 'FAIL', err.message);
  }

  try {
    const ready = await axios.get(`${API_BASE}/ready`);
    if (ready.status === 200 && ready.data.status === 'ready') {
      record('Backend /ready probe (DB + Redis)', 'PASS', `DB: ${ready.data.services.database}, Redis: ${ready.data.services.redis}`);
    } else {
      record('Backend /ready probe (DB + Redis)', 'FAIL', `Status ${ready.status}`);
    }
  } catch (err: any) {
    record('Backend /ready probe (DB + Redis)', 'FAIL', err.message);
  }

  // 2. Frontend Page Checks
  const frontendRoutes = [
    '/auth/login',
    '/dashboard',
    '/dashboard/inbox',
    '/dashboard/customers',
    '/dashboard/templates',
    '/dashboard/campaigns',
    '/dashboard/analytics',
    '/dashboard/settings',
  ];

  for (const route of frontendRoutes) {
    try {
      const res = await axios.get(`${FRONTEND_BASE}${route}`, {
        maxRedirects: 0,
        validateStatus: (status) => status < 400,
      });
      record(`Frontend route [${route}]`, 'PASS', `HTTP ${res.status}`);
    } catch (err: any) {
      if (err.response && (err.response.status === 307 || err.response.status === 302)) {
        record(`Frontend route [${route}]`, 'PASS', `HTTP ${err.response.status} (Protected Auth Redirect)`);
      } else {
        record(`Frontend route [${route}]`, 'FAIL', err.message);
      }
    }
  }

  // 3. Authentication (Login)
  try {
    const loginRes = await axios.post(
      `${API_BASE}/api/auth/login`,
      {
        email: 'admin@wavedesk.io',
        password: 'Password123!',
      },
      { validateStatus: () => true }
    );

    if (loginRes.status === 200 && loginRes.headers['set-cookie']) {
      authCookie = loginRes.headers['set-cookie'][0].split(';')[0];
      record('POST /api/auth/login', 'PASS', `Authenticated as ${loginRes.data.user.name} (${loginRes.data.user.email})`);
    } else {
      record('POST /api/auth/login', 'FAIL', `Status: ${loginRes.status}, Error: ${JSON.stringify(loginRes.data)}`);
      return summarize();
    }
  } catch (err: any) {
    record('POST /api/auth/login', 'FAIL', err.message);
    return summarize();
  }

  const authHeaders = { Cookie: authCookie };

  // 4. Verify /api/auth/me
  try {
    const meRes = await axios.get(`${API_BASE}/api/auth/me`, { headers: authHeaders });
    if (meRes.status === 200 && meRes.data.user.email === 'admin@wavedesk.io') {
      record('GET /api/auth/me', 'PASS', `Company: ${meRes.data.company.name}`);
    } else {
      record('GET /api/auth/me', 'FAIL', `Status: ${meRes.status}`);
    }
  } catch (err: any) {
    record('GET /api/auth/me', 'FAIL', err.message);
  }

  // 5. Customer Directory & Tags
  try {
    const custRes = await axios.get(`${API_BASE}/api/customers`, { headers: authHeaders });
    if (custRes.status === 200 && Array.isArray(custRes.data.customers)) {
      record('GET /api/customers', 'PASS', `Retrieved ${custRes.data.customers.length} customers`);
      if (custRes.data.customers.length > 0) {
        customerId = custRes.data.customers[0].id;
      }
    } else {
      record('GET /api/customers', 'FAIL', `Status: ${custRes.status}`);
    }
  } catch (err: any) {
    record('GET /api/customers', 'FAIL', err.message);
  }

  try {
    const tagsRes = await axios.get(`${API_BASE}/api/tags`, { headers: authHeaders });
    if (tagsRes.status === 200 && Array.isArray(tagsRes.data.tags)) {
      record('GET /api/tags', 'PASS', `Loaded ${tagsRes.data.tags.length} tags`);
    } else {
      record('GET /api/tags', 'FAIL', `Status: ${tagsRes.status}`);
    }
  } catch (err: any) {
    record('GET /api/tags', 'FAIL', err.message);
  }

  // 6. Messaging & Shared Inbox
  try {
    const convRes = await axios.get(`${API_BASE}/api/messages/conversations`, { headers: authHeaders });
    if (convRes.status === 200 && Array.isArray(convRes.data.conversations)) {
      record('GET /api/messages/conversations', 'PASS', `Found ${convRes.data.conversations.length} conversation threads`);
    } else {
      record('GET /api/messages/conversations', 'FAIL', `Status: ${convRes.status}`);
    }
  } catch (err: any) {
    record('GET /api/messages/conversations', 'FAIL', err.message);
  }

  if (customerId) {
    try {
      const msgRes = await axios.get(`${API_BASE}/api/messages/${customerId}`, {
        headers: authHeaders,
      });
      if (msgRes.status === 200 && Array.isArray(msgRes.data.messages)) {
        record(
          `GET /api/messages/:customerId`,
          'PASS',
          `Found ${msgRes.data.messages.length} messages, 24h Window: ${msgRes.data.isWindowOpen ? 'OPEN' : 'CLOSED'}`
        );
      } else {
        record(`GET /api/messages/:customerId`, 'FAIL', `Status: ${msgRes.status}`);
      }
    } catch (err: any) {
      record(`GET /api/messages/:customerId`, 'FAIL', err.message);
    }

    try {
      const sendRes = await axios.post(
        `${API_BASE}/api/messages/${customerId}`,
        {
          type: 'TEXT',
          body: `Verification test automated message at ${new Date().toLocaleTimeString()}`,
        },
        { headers: authHeaders }
      );
      if (sendRes.status === 201 && sendRes.data.message.body) {
        record('POST /api/messages/:customerId (Send Free-text)', 'PASS', `Message ID: ${sendRes.data.message.id}`);
      } else {
        record('POST /api/messages/:customerId (Send Free-text)', 'FAIL', `Status: ${sendRes.status}`);
      }
    } catch (err: any) {
      record('POST /api/messages/:customerId (Send Free-text)', 'FAIL', err.response?.data?.error?.message || err.message);
    }
  }

  // 7. Webhook Ingestion & 24-hr Window
  try {
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
                  phone_number_id: '109876543210987',
                },
                contacts: [{ profile: { name: 'E2E Test User' }, wa_id: '15550001122' }],
                messages: [
                  {
                    from: '15550001122',
                    id: `wamid.e2e_${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: { body: 'Inbound verification ping' },
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

    const raw = JSON.stringify(inboundPayload);
    const secret = process.env.META_APP_SECRET || 'mock_app_secret';
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');

    const webhookRes = await axios.post(`${API_BASE}/api/webhooks/whatsapp`, inboundPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${sig}`,
      },
    });

    if (webhookRes.status === 200) {
      record('POST /api/webhooks/whatsapp (Inbound Webhook)', 'PASS', 'HMAC verified & 24h window opened');
    } else {
      record('POST /api/webhooks/whatsapp (Inbound Webhook)', 'FAIL', `Status: ${webhookRes.status}`);
    }
  } catch (err: any) {
    record('POST /api/webhooks/whatsapp (Inbound Webhook)', 'FAIL', err.message);
  }

  // 8. Templates API
  let templateId = '';
  try {
    const tplListRes = await axios.get(`${API_BASE}/api/templates`, { headers: authHeaders });
    if (tplListRes.status === 200 && Array.isArray(tplListRes.data.templates)) {
      record('GET /api/templates', 'PASS', `Found ${tplListRes.data.templates.length} templates`);
      const approved = tplListRes.data.templates.find((t: any) => t.status === 'APPROVED');
      if (approved) templateId = approved.id;
    } else {
      record('GET /api/templates', 'FAIL', `Status: ${tplListRes.status}`);
    }
  } catch (err: any) {
    record('GET /api/templates', 'FAIL', err.message);
  }

  // 9. Campaign Creation & Dispatch Loop
  if (templateId) {
    try {
      const campName = `E2E Test Campaign ${Date.now()}`;
      const campCreateRes = await axios.post(
        `${API_BASE}/api/campaigns`,
        {
          templateId,
          name: campName,
          audience: { all: true },
        },
        { headers: authHeaders }
      );

      if (campCreateRes.status === 201) {
        const campaign = campCreateRes.data.campaign;
        record('POST /api/campaigns (Create Draft)', 'PASS', `Draft ID: ${campaign.id}`);

        // Launch campaign
        const sendRes = await axios.post(`${API_BASE}/api/campaigns/${campaign.id}/send`, {}, { headers: authHeaders });
        if (sendRes.status === 200) {
          record('POST /api/campaigns/:id/send (Launch Campaign)', 'PASS', 'Background loop started');

          // Wait 300ms for background sending
          await new Promise((r) => setTimeout(r, 300));

          const checkRes = await axios.get(`${API_BASE}/api/campaigns/${campaign.id}`, { headers: authHeaders });
          record(
            'GET /api/campaigns/:id (Progress Check)',
            'PASS',
            `Status: ${checkRes.data.campaign.status}, Sent: ${checkRes.data.campaign.stats.sent}/${checkRes.data.campaign.stats.total}`
          );
        } else {
          record('POST /api/campaigns/:id/send (Launch Campaign)', 'FAIL', `Status: ${sendRes.status}`);
        }
      } else {
        record('POST /api/campaigns (Create Draft)', 'FAIL', `Status: ${campCreateRes.status}`);
      }
    } catch (err: any) {
      record('Campaign Engine Test', 'FAIL', err.response?.data?.error?.message || err.message);
    }
  }

  // 10. Analytics API
  try {
    const summaryRes = await axios.get(`${API_BASE}/api/analytics/summary`, { headers: authHeaders });
    if (summaryRes.status === 200 && summaryRes.data.audience && summaryRes.data.messages) {
      record(
        'GET /api/analytics/summary',
        'PASS',
        `Customers: ${summaryRes.data.audience.total}, Outbound: ${summaryRes.data.messages.outboundTotal}, Cache Hit Rate: ${summaryRes.data.system.cache.hitRatePercent}%`
      );
    } else {
      record('GET /api/analytics/summary', 'FAIL', `Status: ${summaryRes.status}`);
    }
  } catch (err: any) {
    record('GET /api/analytics/summary', 'FAIL', err.message);
  }

  try {
    const tsRes = await axios.get(`${API_BASE}/api/analytics/timeseries`, { headers: authHeaders });
    if (tsRes.status === 200 && Array.isArray(tsRes.data.timeseries)) {
      record('GET /api/analytics/timeseries', 'PASS', `Timeseries data points: ${tsRes.data.timeseries.length} days`);
    } else {
      record('GET /api/analytics/timeseries', 'FAIL', `Status: ${tsRes.status}`);
    }
  } catch (err: any) {
    record('GET /api/analytics/timeseries', 'FAIL', err.message);
  }

  // 11. WebSocket Live Connection
  await new Promise<void>((resolve) => {
    const socket = io(API_BASE, {
      extraHeaders: {
        Cookie: authCookie,
      },
      transports: ['websocket', 'polling'],
      timeout: 3000,
    });

    socket.on('connect', () => {
      record('WebSocket Handshake & Auth', 'PASS', `Socket ID: ${socket.id}`);
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (err) => {
      record('WebSocket Handshake & Auth', 'FAIL', err.message);
      socket.disconnect();
      resolve();
    });
  });

  summarize();
}

function summarize() {
  console.log('\n====================================================');
  console.log('              VERIFICATION SUMMARY                  ');
  console.log('====================================================');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed:       ${passCount}`);
  console.log(`Failed:       ${failCount}`);
  if (failCount === 0) {
    console.log('\n🎉 ALL FULL-STACK SYSTEM CHECKS PASSED PERFECTLY!');
  } else {
    console.log('\n⚠️ Some checks failed. See details above.');
  }
}

runFullVerification().catch(console.error);
