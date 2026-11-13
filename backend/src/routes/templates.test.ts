import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../services/database';
import { TemplateCategory, TemplateStatus } from '@prisma/client';

describe('Templates Routes', () => {
  let companyAId: string;
  let companyBId: string;
  let authCookieA: string;
  let authCookieB: string;

  beforeAll(async () => {
    // 1. Signup Company A
    const resA = await request(app).post('/api/auth/signup').send({
      companyName: 'Templates Test Co A',
      name: 'Owner A',
      email: `templates_a_${Date.now()}@test.com`,
      password: 'Password123!',
    });
    companyAId = resA.body.company.id;
    authCookieA = resA.headers['set-cookie'][0];

    // 2. Signup Company B
    const resB = await request(app).post('/api/auth/signup').send({
      companyName: 'Templates Test Co B',
      name: 'Owner B',
      email: `templates_b_${Date.now()}@test.com`,
      password: 'Password123!',
    });
    companyBId = resB.body.company.id;
    authCookieB = resB.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await prisma.template.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.user.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyAId, companyBId] } },
    });
  });

  it('rejects template creation with invalid name characters (uppercase or spaces)', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Cookie', authCookieA)
      .send({
        name: 'Invalid Template Name!',
        category: TemplateCategory.MARKETING,
        language: 'en_US',
        components: [{ type: 'BODY', text: 'Hello {{1}}' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body.error.details)).toContain('lowercase');
  });

  it('successfully creates an approved template in mock mode', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Cookie', authCookieA)
      .send({
        name: 'summer_promo_2026',
        category: TemplateCategory.MARKETING,
        language: 'en_US',
        components: [
          { type: 'HEADER', format: 'TEXT', text: 'Summer Sale' },
          { type: 'BODY', text: 'Hi {{1}}, enjoy 30% off with code {{2}}!' },
          { type: 'FOOTER', text: 'Reply STOP to opt out' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.template.name).toBe('summer_promo_2026');
    expect(res.body.template.status).toBe(TemplateStatus.APPROVED);
    expect(res.body.template.companyId).toBe(companyAId);
  });

  it('rejects duplicate template name within the same company and language', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Cookie', authCookieA)
      .send({
        name: 'summer_promo_2026',
        category: TemplateCategory.MARKETING,
        language: 'en_US',
        components: [{ type: 'BODY', text: 'Duplicate test' }],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('enforces tenant isolation: Company B cannot see Company A templates', async () => {
    const resA = await request(app).get('/api/templates').set('Cookie', authCookieA);
    expect(resA.status).toBe(200);
    const hasSummerPromo = resA.body.templates.some((t: any) => t.name === 'summer_promo_2026');
    expect(hasSummerPromo).toBe(true);

    const resB = await request(app).get('/api/templates').set('Cookie', authCookieB);
    expect(resB.status).toBe(200);
    const bHasSummerPromo = resB.body.templates.some((t: any) => t.name === 'summer_promo_2026');
    expect(bHasSummerPromo).toBe(false);
  });

  it('syncs pre-approved standard templates in mock mode', async () => {
    const res = await request(app).post('/api/templates/sync').set('Cookie', authCookieB);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);

    const tplNames = res.body.templates.map((t: any) => t.name);
    expect(tplNames).toContain('welcome_offer');
  });
});
