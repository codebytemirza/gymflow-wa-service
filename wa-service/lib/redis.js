// ============================================================
// wa-service/lib/redis.js
// ioredis client — shared singleton
// ============================================================
import Redis from 'ioredis';
import 'dotenv/config';

const redis = new Redis(process.env.REDIS_URL, {
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('error', (err) => console.error('[Redis] error:', err.message));
redis.on('connect', () => console.log('[Redis] connected'));

export default redis;
