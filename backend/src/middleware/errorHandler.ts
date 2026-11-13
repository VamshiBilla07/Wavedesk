import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input parameters',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  // Custom application error
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Prisma database errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(', ')
        : 'unique field';
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: `A record with this ${target} already exists`,
        },
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found',
        },
      });
      return;
    }
  }

  // Unhandled internal server error
  console.error('[Unhandled Error]', err);
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred'
      : (err instanceof Error ? err.message : 'Unknown internal error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}
