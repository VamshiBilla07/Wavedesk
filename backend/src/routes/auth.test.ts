import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../services/database';

describe('Auth Routes', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testCompany = 'Test Company Inc';
  const testName = 'Test Admin';
  let authCookie = '';

  beforeAll(async () => {
    // Clean up if user already exists
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  afterAll(async () => {
    // Clean up test data
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    if (user) {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.company.delete({ where: { id: user.companyId } });
    }
  });

  it('POST /api/auth/signup creates a new company and owner user', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        companyName: testCompany,
        name: testName,
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.role).toBe('OWNER');
    expect(res.body.company.name).toBe(testCompany);
    expect(res.body.token).toBeDefined();

    // Check Set-Cookie header
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    expect(cookieHeader).toContain('wavedesk_token=');
  });

  it('POST /api/auth/signup returns 409 when email already exists', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        companyName: 'Another Company',
        name: 'Another User',
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('POST /api/auth/login succeeds with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.token).toBeDefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    authCookie = cookieHeader;
  });

  it('POST /api/auth/login fails with invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/me returns profile when authenticated via cookie', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.company.name).toBe(testCompany);
  });

  it('GET /api/auth/me returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/auth/logout clears auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    expect(cookieHeader).toContain('wavedesk_token=;');
  });

  it('POST /api/auth/google creates a new user and company with mock token', async () => {
    const googleEmail = `google_${Date.now()}@gmail.com`;
    const res = await request(app)
      .post('/api/auth/google')
      .send({
        idToken: `mock_google_token_${googleEmail}__Google%20User`,
        companyName: 'Google Tenant Co',
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(googleEmail);
    expect(res.body.user.role).toBe('OWNER');
    expect(res.body.company.name).toBe('Google Tenant Co');
    expect(res.body.token).toBeDefined();

    // Verify user in db has googleId and no passwordHash
    const dbUser = await prisma.user.findUnique({
      where: { email: googleEmail },
    });
    expect(dbUser).toBeDefined();
    expect(dbUser?.googleId).toBeTruthy();
    expect(dbUser?.passwordHash).toBeNull();

    // Clean up
    if (dbUser) {
      await prisma.user.delete({ where: { id: dbUser.id } });
      await prisma.company.delete({ where: { id: dbUser.companyId } });
    }
  });

  it('POST /api/auth/google links existing email user with google account', async () => {
    // testEmail was created in earlier signup test
    const res = await request(app)
      .post('/api/auth/google')
      .send({
        idToken: `mock_google_token_${testEmail}__Linked%20User`,
      });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.company.name).toBe(testCompany);

    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    expect(dbUser?.googleId).toBeTruthy();
    expect(dbUser?.passwordHash).toBeTruthy(); // Original password preserved
  });

  it('POST /api/auth/google returns 400 when idToken is missing', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /health returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });
});
