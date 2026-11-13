import { describe, it, expect } from 'vitest';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole, signToken, AuthUser } from './auth';

describe('Auth Middleware', () => {
  const mockUser: AuthUser = {
    id: 'user_123',
    email: 'agent@example.com',
    role: Role.AGENT,
    companyId: 'company_123',
  };

  it('authenticates successfully via Bearer token', () => {
    const token = signToken(mockUser);
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      cookies: {},
    } as unknown as Request;

    const res = {} as Response;
    let nextCalled = false;
    let nextError: unknown = null;

    authenticate(req, res, (err) => {
      nextCalled = true;
      nextError = err;
    });

    expect(nextCalled).toBe(true);
    expect(nextError).toBeUndefined();
    expect(req.user).toBeDefined();
    expect(req.user?.id).toBe(mockUser.id);
    expect(req.user?.companyId).toBe(mockUser.companyId);
    expect(req.user?.role).toBe(mockUser.role);
  });

  it('rejects when token is invalid or missing', () => {
    const req = {
      headers: {},
      cookies: {},
    } as unknown as Request;

    const res = {} as Response;
    let nextError: any = null;

    authenticate(req, res, (err) => {
      nextError = err;
    });

    expect(nextError).toBeDefined();
    expect(nextError?.statusCode).toBe(401);
  });

  it('requireRole allows permitted roles', () => {
    const req = {
      user: {
        id: 'user_123',
        role: Role.OWNER,
        companyId: 'company_123',
      },
    } as unknown as Request;

    const res = {} as Response;
    let nextCalled = false;
    let nextError: unknown = null;

    const guard = requireRole(Role.OWNER, Role.ADMIN);
    guard(req, res, (err) => {
      nextCalled = true;
      nextError = err;
    });

    expect(nextCalled).toBe(true);
    expect(nextError).toBeUndefined();
  });

  it('requireRole denies unpermitted roles with 403', () => {
    const req = {
      user: {
        id: 'user_123',
        role: Role.AGENT,
        companyId: 'company_123',
      },
    } as unknown as Request;

    const res = {} as Response;
    let nextError: any = null;

    const guard = requireRole(Role.OWNER, Role.ADMIN);
    guard(req, res, (err) => {
      nextError = err;
    });

    expect(nextError).toBeDefined();
    expect(nextError?.statusCode).toBe(403);
    expect(nextError?.code).toBe('FORBIDDEN');
  });
});
