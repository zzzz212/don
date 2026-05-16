import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitEndpoint =
  | "analyze"
  | "chat"
  | "generate"
  | "billing.checkout"
  | "network"
  | "default";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

const LIMITS: Record<RateLimitEndpoint, { max: number; windowSec: number }> = {
  analyze: { max: 10, windowSec: 60 },
  chat: { max: 30, windowSec: 60 },
  generate: { max: 10, windowSec: 60 },
  // Checkout creates pending Payment rows + calls ЮKassa — keep loose so
  // legitimate retries (network drop on confirmation page) don't trigger
  // 429s but still cap brute-force attempts.
  "billing.checkout": { max: 10, windowSec: 60 },
  // Network mutations — connection requests, shares, comments, messages.
  // Loose enough for a real back-and-forth chat, tight enough that a
  // script can't fan out hundreds of requests / messages.
  network: { max: 30, windowSec: 60 },
  default: { max: 60, windowSec: 60 },
};

// ── Upstash backend ─────────────────────────────────────────────────

let upstashRedis: Redis | null = null;
const upstashLimiters: Partial<Record<RateLimitEndpoint, Ratelimit>> = {};

function getUpstashRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (!upstashRedis) {
    upstashRedis = new Redis({ url, token });
  }
  return upstashRedis;
}

function getUpstashLimiter(endpoint: RateLimitEndpoint): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;

  const cached = upstashLimiters[endpoint];
  if (cached) return cached;

  const cfg = LIMITS[endpoint];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(cfg.max, `${cfg.windowSec} s`),
    prefix: `rl:${endpoint}`,
    analytics: false,
  });
  upstashLimiters[endpoint] = limiter;
  return limiter;
}

async function rateLimitUpstash(
  limiter: Ratelimit,
  key: string,
  endpoint: RateLimitEndpoint
): Promise<RateLimitResult> {
  const cfg = LIMITS[endpoint];
  try {
    const { success, remaining, reset } = await limiter.limit(key);
    return {
      ok: success,
      remaining,
      limit: cfg.max,
      resetAt: reset,
    };
  } catch (e) {
    console.error(`[rate-limit] Upstash error, falling back to in-memory:`, (e as Error).message);
    return rateLimitMemory(key, endpoint);
  }
}

// ── In-memory fallback ──────────────────────────────────────────────

const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimitMemory(key: string, endpoint: RateLimitEndpoint): RateLimitResult {
  const cfg = LIMITS[endpoint];
  const bucketKey = `${endpoint}:${key}`;
  const now = Date.now();

  let bucket = buckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + cfg.windowSec * 1000 };
    buckets.set(bucketKey, bucket);
  }

  bucket.count++;

  return {
    ok: bucket.count <= cfg.max,
    remaining: Math.max(0, cfg.max - bucket.count),
    limit: cfg.max,
    resetAt: bucket.resetAt,
  };
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  }, 60_000);
}

// ── Public API ──────────────────────────────────────────────────────

export async function rateLimit(
  key: string,
  endpoint: RateLimitEndpoint = "default"
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(endpoint);
  if (limiter) return rateLimitUpstash(limiter, key, endpoint);
  return rateLimitMemory(key, endpoint);
}

export function getRateLimitBackend(): "upstash" | "memory" {
  return getUpstashRedis() ? "upstash" : "memory";
}
