import Redis from 'ioredis';

let hitCount = 0;
let missCount = 0;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
});

let isConnected = false;

redis.on('connect', () => {
  isConnected = true;
});

redis.on('error', (err) => {
  isConnected = false;
  // Non-fatal warning so the app can fall back to the database gracefully
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[Redis] Connection warning:', err.message);
  }
});

// Attempt initial connection without blocking app startup
redis.connect().catch(() => {
  isConnected = false;
});

/**
 * Checks if Redis is currently reachable
 */
export async function isRedisReady(): Promise<boolean> {
  try {
    const res = await redis.ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Retrieves an item from cache, or fetches from loader and stores if absent.
 * Falls back to loader if Redis is unavailable.
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  if (isConnected) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        hitCount++;
        return JSON.parse(cached) as T;
      }
    } catch {
      // Redis error, proceed to loader
    }
  }

  missCount++;
  const data = await loader();

  if (isConnected && data !== undefined && data !== null) {
    try {
      await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch {
      // Non-fatal if caching fails
    }
  }

  return data;
}

/**
 * Invalidates cache keys matching a glob pattern (e.g., 'co:123:*')
 */
export async function invalidate(pattern: string): Promise<void> {
  if (!isConnected) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Convenience helper to invalidate company-scoped cache keys
 */
export async function invalidateCompany(companyId: string, resource?: string): Promise<void> {
  const pattern = resource ? `co:${companyId}:${resource}:*` : `co:${companyId}:*`;
  await invalidate(pattern);
}

/**
 * Returns cache metrics (hits, misses, hit rate)
 */
export function getCacheStats(): { hits: number; misses: number; hitRate: number } {
  const total = hitCount + missCount;
  const hitRate = total === 0 ? 0 : Number(((hitCount / total) * 100).toFixed(2));
  return { hits: hitCount, misses: missCount, hitRate };
}
