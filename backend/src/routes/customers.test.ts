import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Role } from '@prisma/client';
import { app } from '../server';
import { prisma } from '../services/database';
import { signToken } from '../middleware/auth';

describe('Customer Routes & Multi-tenant Isolation', () => {
  const companyAId = `comp_a_${Date.now()}`;
  const companyBId = `comp_b_${Date.now()}`;

  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    // Setup Company A and User A
    await prisma.company.create({
      data: { id: companyAId, name: 'Company A' },
    });
    const userA = await prisma.user.create({
      data: {
        companyId: companyAId,
        email: `usera_${Date.now()}@companya.com`,
        name: 'User A',
        passwordHash: 'hashed',
        role: Role.OWNER,
      },
    });
    tokenA = signToken({
      id: userA.id,
      email: userA.email,
      role: userA.role,
      companyId: companyAId,
    });

    // Setup Company B and User B
    await prisma.company.create({
      data: { id: companyBId, name: 'Company B' },
    });
    const userB = await prisma.user.create({
      data: {
        companyId: companyBId,
        email: `userb_${Date.now()}@companyb.com`,
        name: 'User B',
        passwordHash: 'hashed',
        role: Role.OWNER,
      },
    });
    tokenB = signToken({
      id: userB.id,
      email: userB.email,
      role: userB.role,
      companyId: companyBId,
    });
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.customer.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
  });

  it('creates and lists customers for Company A', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        phone: '15551112233',
        name: 'Customer A1',
        email: 'a1@example.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.customer.name).toBe('Customer A1');
    expect(res.body.customer.phone).toBe('15551112233');

    const listRes = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.customers.length).toBe(1);
    expect(listRes.body.customers[0].phone).toBe('15551112233');
  });

  it('enforces tenant isolation: Company B cannot see Company A customers', async () => {
    const listResB = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(listResB.status).toBe(200);
    expect(listResB.body.customers.length).toBe(0); // Company B sees zero customers
  });

  it('imports customers from CSV with error reporting', async () => {
    const csvContent = `Phone,Name,Email
15552223344,Valid One,valid1@example.com
15553334455,Valid Two,valid2@example.com
invalid_phone,Broken Contact,bad@example.com
15552223344,Duplicate Phone,dup@example.com
`;

    const res = await request(app)
      .post('/api/customers/import')
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('file', Buffer.from(csvContent), 'customers.csv');

    expect(res.status).toBe(200);
    expect(res.body.totalRows).toBe(4);
    expect(res.body.imported).toBe(2);
    expect(res.body.failed).toBe(2);
    expect(res.body.errors.length).toBe(2);
    expect(res.body.errors[0].error).toContain('Invalid phone number');
    expect(res.body.errors[1].error).toContain('Duplicate phone number');
  });

  it('exports customers to CSV', async () => {
    const res = await request(app)
      .get('/api/customers/export')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Phone,Name,Email');
    expect(res.text).toContain('15551112233');
  });
});
