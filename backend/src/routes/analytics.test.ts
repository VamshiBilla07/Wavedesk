import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../services/database';
import { Direction, MessageStatus } from '@prisma/client';

describe('Analytics Routes', () => {
  let companyId: string;
  let authCookie: string;
  let customerId: string;

  beforeAll(async () => {
    // 1. Signup company
    const signupRes = await request(app).post('/api/auth/signup').send({
      companyName: 'Analytics Test Co',
      name: 'Analyst',
      email: `analytics_${Date.now()}@test.com`,
      password: 'Password123!',
    });
    companyId = signupRes.body.company.id;
    authCookie = signupRes.headers['set-cookie'][0];

    // 2. Create customer with open 24h window
    const cust = await prisma.customer.create({
      data: {
        companyId,
        phone: '15557778888',
        name: 'Analytics Contact',
        lastCustomerMessageAt: new Date(),
        optedOut: false,
      },
    });
    customerId = cust.id;

    // 3. Create sample messages (inbound & outbound)
    await prisma.message.create({
      data: {
        companyId,
        customerId,
        direction: Direction.INBOUND,
        body: 'Inbound message',
        status: MessageStatus.DELIVERED,
      },
    });

    await prisma.message.create({
      data: {
        companyId,
        customerId,
        direction: Direction.OUTBOUND,
        body: 'Outbound delivered',
        status: MessageStatus.DELIVERED,
      },
    });

    await prisma.message.create({
      data: {
        companyId,
        customerId,
        direction: Direction.OUTBOUND,
        body: 'Outbound read',
        status: MessageStatus.READ,
      },
    });
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { companyId } });
    await prisma.customer.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it('GET /api/analytics/summary returns computed KPIs and cache telemetry', async () => {
    const res = await request(app)
      .get('/api/analytics/summary')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.audience).toBeDefined();
    expect(res.body.audience.total).toBe(1);
    expect(res.body.audience.active24hWindows).toBe(1);

    expect(res.body.messages).toBeDefined();
    expect(res.body.messages.inboundTotal).toBe(1);
    expect(res.body.messages.outboundTotal).toBe(2);
    expect(res.body.messages.deliveryRate).toBeGreaterThan(0);

    expect(res.body.system.cache).toBeDefined();
    expect(typeof res.body.system.cache.hitRate).toBe('number');
  });

  it('GET /api/analytics/timeseries returns 14 daily date buckets', async () => {
    const res = await request(app)
      .get('/api/analytics/timeseries')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.timeseries)).toBe(true);
    expect(res.body.timeseries.length).toBe(14);

    const todayKey = new Date().toISOString().split('T')[0];
    const todayBucket = res.body.timeseries.find((b: any) => b.date === todayKey);
    expect(todayBucket).toBeDefined();
    expect(todayBucket.total).toBeGreaterThanOrEqual(3);
  });
});
