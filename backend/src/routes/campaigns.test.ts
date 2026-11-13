import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../services/database';
import { CampaignStatus, TemplateCategory, TemplateStatus } from '@prisma/client';

describe('Campaigns Routes & Background Sending Engine', () => {
  let companyId: string;
  let authCookie: string;
  let approvedTemplateId: string;
  let customer1Id: string;
  let customer2Id: string;
  let optedOutCustomerId: string;

  beforeAll(async () => {
    // 1. Create company & auth
    const signupRes = await request(app).post('/api/auth/signup').send({
      companyName: 'Campaigns Test Co',
      name: 'Campaign Manager',
      email: `campaigns_co_${Date.now()}@test.com`,
      password: 'Password123!',
    });
    companyId = signupRes.body.company.id;
    authCookie = signupRes.headers['set-cookie'][0];

    // 2. Create an approved template
    const tpl = await prisma.template.create({
      data: {
        companyId,
        name: 'flash_sale',
        language: 'en_US',
        category: TemplateCategory.MARKETING,
        status: TemplateStatus.APPROVED,
        components: [
          { type: 'BODY', text: 'Hi {{1}}, flash sale starts now!' },
        ],
      },
    });
    approvedTemplateId = tpl.id;

    // 3. Create customers: 2 active, 1 opted-out
    const c1 = await prisma.customer.create({
      data: {
        companyId,
        phone: '15550001111',
        name: 'Bob',
        optedOut: false,
      },
    });
    customer1Id = c1.id;

    const c2 = await prisma.customer.create({
      data: {
        companyId,
        phone: '15550002222',
        name: 'Charlie',
        optedOut: false,
      },
    });
    customer2Id = c2.id;

    const c3 = await prisma.customer.create({
      data: {
        companyId,
        phone: '15550003333',
        name: 'Dave (Opted Out)',
        optedOut: true,
      },
    });
    optedOutCustomerId = c3.id;
  });

  afterAll(async () => {
    await prisma.campaignRecipient.deleteMany({
      where: { campaign: { companyId } },
    });
    await prisma.campaign.deleteMany({ where: { companyId } });
    await prisma.message.deleteMany({ where: { companyId } });
    await prisma.template.deleteMany({ where: { companyId } });
    await prisma.customer.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it('creates a campaign draft and correctly excludes opted-out contacts from audience count', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Cookie', authCookie)
      .send({
        name: 'Spring Flash Sale',
        templateId: approvedTemplateId,
        audience: {
          customerIds: [customer1Id, customer2Id, optedOutCustomerId],
        },
        variableMap: {
          '1': 'name',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.campaign.name).toBe('Spring Flash Sale');
    expect(res.body.campaign.status).toBe(CampaignStatus.DRAFT);
    // Should exclude the opted-out customer, counting only 2
    expect(res.body.audienceCount).toBe(2);
    expect(res.body.campaign.total).toBe(2);
  });

  it('rejects launching campaign if template is not APPROVED', async () => {
    const pendingTpl = await prisma.template.create({
      data: {
        companyId,
        name: 'pending_tpl',
        language: 'en_US',
        category: TemplateCategory.UTILITY,
        status: TemplateStatus.PENDING,
        components: [{ type: 'BODY', text: 'Pending template' }],
      },
    });

    const draft = await prisma.campaign.create({
      data: {
        companyId,
        templateId: pendingTpl.id,
        name: 'Pending Campaign',
        status: CampaignStatus.DRAFT,
        audience: { all: true },
        total: 1,
      },
    });

    const res = await request(app)
      .post(`/api/campaigns/${draft.id}/send`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TEMPLATE_NOT_APPROVED');
  });

  it('launches campaign, creates recipients, and dispatches via background loop', async () => {
    const createRes = await request(app)
      .post('/api/campaigns')
      .set('Cookie', authCookie)
      .send({
        name: 'VIP Discount Blast',
        templateId: approvedTemplateId,
        audience: {
          customerIds: [customer1Id, customer2Id],
        },
        variableMap: { '1': 'name' },
      });

    const campaignId = createRes.body.campaign.id;

    const sendRes = await request(app)
      .post(`/api/campaigns/${campaignId}/send`)
      .set('Cookie', authCookie);

    expect(sendRes.status).toBe(200);
    expect(sendRes.body.campaign.status).toBe(CampaignStatus.RUNNING);

    // Wait 400ms for background processing loop to complete
    await new Promise((r) => setTimeout(r, 400));

    // Verify campaign details
    const getRes = await request(app)
      .get(`/api/campaigns/${campaignId}`)
      .set('Cookie', authCookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.campaign.status).toBe(CampaignStatus.COMPLETED);
    expect(getRes.body.campaign.stats.sent).toBe(2);
    expect(getRes.body.campaign.stats.total).toBe(2);

    // Verify messages were recorded in customer threads
    const messages = await prisma.message.findMany({
      where: { companyId, customerId: customer1Id },
    });
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].templateName).toBe('flash_sale');
  });

  it('supports pause and resume lifecycle transitions', async () => {
    const campaign1 = await prisma.campaign.create({
      data: {
        companyId,
        templateId: approvedTemplateId,
        name: 'Pause Resume Test',
        status: CampaignStatus.RUNNING,
        audience: { all: true },
        total: 10,
      },
    });

    const pauseRes = await request(app)
      .post(`/api/campaigns/${campaign1.id}/pause`)
      .set('Cookie', authCookie);
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.campaign.status).toBe(CampaignStatus.PAUSED);

    const resumeRes = await request(app)
      .post(`/api/campaigns/${campaign1.id}/resume`)
      .set('Cookie', authCookie);
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.campaign.status).toBe(CampaignStatus.RUNNING);

    const campaign2 = await prisma.campaign.create({
      data: {
        companyId,
        templateId: approvedTemplateId,
        name: 'Cancel Test',
        status: CampaignStatus.RUNNING,
        audience: { all: true },
        total: 10,
      },
    });

    const cancelRes = await request(app)
      .post(`/api/campaigns/${campaign2.id}/cancel`)
      .set('Cookie', authCookie);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.campaign.status).toBe(CampaignStatus.CANCELLED);
  });
});
