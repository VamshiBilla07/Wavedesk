import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { prisma } from '../services/database';
import { signupSchema, loginSchema } from '../validation/auth';
import { AppError } from '../middleware/errorHandler';
import {
  authenticate,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  AuthUser,
} from '../middleware/auth';

const router = Router();
const BCRYPT_SALT_ROUNDS = 12;

/**
 * POST /api/auth/signup
 * Registers a new company and its OWNER user account.
 */
router.post(
  '/signup',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = signupSchema.parse(req.body);

      // Check for existing user with this email
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new AppError('CONFLICT', 'A user with this email already exists', 409);
      }

      // Hash password with bcrypt cost 12
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

      // Create Company and Owner User in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: input.companyName,
          },
        });

        const user = await tx.user.create({
          data: {
            companyId: company.id,
            email: input.email,
            name: input.name,
            passwordHash,
            role: Role.OWNER,
          },
        });

        return { company, user };
      });

      const authUser: AuthUser = {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        companyId: result.company.id,
      };

      const token = signToken(authUser);
      setAuthCookie(res, token);

      res.status(201).json({
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          companyId: result.company.id,
        },
        company: {
          id: result.company.id,
          name: result.company.name,
        },
        token,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticates user credentials and issues JWT in httpOnly cookie and response body.
 */
router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: input.email },
        include: { company: true },
      });

      if (!user) {
        throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
      }

      const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      };

      const token = signToken(authUser);
      setAuthCookie(res, token);

      res.status(200).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
        company: {
          id: user.company.id,
          name: user.company.name,
        },
        token,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/logout
 * Clears the authentication cookie.
 */
router.post('/logout', (_req: Request, res: Response): void => {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile and company.
 */
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { company: true },
      });

      if (!user) {
        throw new AppError('NOT_FOUND', 'User profile not found', 404);
      }

      res.status(200).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
        company: {
          id: user.company.id,
          name: user.company.name,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
