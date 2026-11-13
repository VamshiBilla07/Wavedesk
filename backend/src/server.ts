import http from 'http';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { z } from 'zod';
import { prisma } from './services/database';
import { isRedisReady, redis } from './services/cache';
import { initSocket, closeSocket } from './services/socket';
import authRouter from './routes/auth';
import webhooksRouter from './routes/webhooks';
import settingsRouter from './routes/settings';
import contactTypesRouter from './routes/contactTypes';
import tagsRouter from './routes/tags';
import customersRouter from './routes/customers';
import messagesRouter from './routes/messages';
import templatesRouter from './routes/templates';
import campaignsRouter from './routes/campaigns';
import { resumeRunningCampaigns } from './services/whatsapp';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  WHATSAPP_MOCK: z.string().default('true'),
  CAMPAIGN_RATE_PER_SEC: z
    .string()
    .default('20')
    .transform((val) => parseInt(val, 10)),
});

// Fail-fast environment validation
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error('Invalid environment configuration:');
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsedEnv.data;

export const app = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(cookieParser());

// JSON body parser with rawBody capture for webhook signature verification
app.use(
  express.json({
    limit: '10mb',
    verify: (req: Request, _res: Response, buf: Buffer) => {
      // Attaching rawBody buffer for HMAC-SHA256 signature verification in webhooks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Liveness health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness check (database and redis connectivity)
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    const dbOk = await prisma.$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    const redisOk = await isRedisReady();

    const isReady = dbOk; // Redis is soft-dependent with DB fallback

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'degraded',
      services: {
        database: dbOk ? 'up' : 'down',
        redis: redisOk ? 'up' : 'down',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Readiness check failed',
    });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/contact-types', contactTypesRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/campaigns', campaignsRouter);

// Centralized error handling middleware
app.use(errorHandler);

export const server = http.createServer(app);

// Initialize Socket.io server
export const io = initSocket(server);

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(config.PORT, () => {
    console.log(`[Wavedesk API] Server running on port ${config.PORT} (${config.NODE_ENV})`);
    resumeRunningCampaigns();
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[Wavedesk API] Received ${signal}. Gracefully shutting down...`);
    await closeSocket();
    server.close(async () => {
      console.log('[Wavedesk API] HTTP server closed.');
      await prisma.$disconnect().catch(() => {});
      redis.disconnect();
      console.log('[Wavedesk API] Database and Redis connections closed. Exiting process.');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown stalls
    setTimeout(() => {
      console.error('[Wavedesk API] Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
