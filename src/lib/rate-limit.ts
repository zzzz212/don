const buckets = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  analyze: { max: 10, windowMs: 60_000 },
  chat: { max: 30, windowMs: 60_000 },
  generate: { max: 10, windowMs: 60_000 },
  default: { max: 60, windowMs: 60_000 },
};

export function rateLimit(
  key: string,
  endpoint: string
): { ok: boolean; remaining: number } {
  const config = LIMITS[endpoint] || LIMITS.default;
  const bucketKey = `${endpoint}:${key}`;
  const now = Date.now();

  let bucket = buckets.get(bucketKey);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + config.windowMs };
    buckets.set(bucketKey, bucket);
  }

  bucket.count++;

  if (bucket.count > config.max) {
    return { ok: false, remaining: 0 };
  }

  return { ok: true, remaining: config.max - bucket.count };
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  }, 60_000);
}
