import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../services/cache';

const isTest = process.env.NODE_ENV === 'test';

function createRedisStore(prefix: string) {
  try {
    return new RedisStore({
      prefix: `rl:${prefix}:`,
      // @ts-expect-error - ioredis call signature compatibility with rate-limit-redis
      sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args),
    });
  } catch {
    return undefined; // In-memory fallback
  }
}

/**
 * Strict rate limiter for authentication routes (login/signup)
 * 15 minutes window, max 15 requests
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
  store: isTest ? undefined : createRedisStore('auth'),
});

/**
 * Standard API rate limiter for regular authenticated endpoints
 * 1 minute window, max 120 requests
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 10000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please slow down.',
    },
  },
  store: isTest ? undefined : createRedisStore('api'),
});

/**
 * Webhook rate limiter for WhatsApp Cloud API ingestion
 * 1 minute window, max 300 requests
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Webhook rate limit exceeded.',
    },
  },
  store: isTest ? undefined : createRedisStore('wh'),
});

export default {
  authLimiter,
  apiLimiter,
  webhookLimiter,
};
