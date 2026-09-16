import { AppError } from './errors';

/**
 * In-process sliding-window rate limiting.
 *
 * REBUILD PROPOSAL — this is deliberately the simple version. It protects a
 * single instance, which is what a modular monolith on one node needs. Running
 * multiple instances requires a shared store (Redis); the interface below is
 * the seam where that swap happens, and nothing else changes.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export interface RateLimitRule {
  /** Maximum requests allowed inside the window. */
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 15 * 60 * 1000 },
  agentLogin: { limit: 8, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  orderCreate: { limit: 12, windowMs: 10 * 60 * 1000 },
  orderTracking: { limit: 20, windowMs: 10 * 60 * 1000 },
  aiGeneration: { limit: 20, windowMs: 60 * 60 * 1000 },
  tokenCreate: { limit: 10, windowMs: 60 * 60 * 1000 },
  upload: { limit: 60, windowMs: 10 * 60 * 1000 },
  integrationTest: { limit: 20, windowMs: 10 * 60 * 1000 },
  importJob: { limit: 10, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitKey = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(kind: RateLimitKey, identifier: string): RateLimitResult {
  const rule = RATE_LIMITS[kind];
  const now = Date.now();
  const key = `${kind}:${identifier}`;

  sweep(now);

  const bucket = buckets.get(key) ?? { hits: [] };
  const cutoff = now - rule.windowMs;
  bucket.hits = bucket.hits.filter((hit) => hit > cutoff);

  if (bucket.hits.length >= rule.limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0] ?? now;
    return { allowed: false, remaining: 0, retryAfterMs: oldest + rule.windowMs - now };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: rule.limit - bucket.hits.length, retryAfterMs: 0 };
}

export function enforceRateLimit(kind: RateLimitKey, identifier: string): void {
  const result = checkRateLimit(kind, identifier);
  if (!result.allowed) {
    throw new AppError('RATE_LIMITED', 'Too many requests.', {
      meta: { retryAfterMs: result.retryAfterMs },
    });
  }
}

/** Clear a bucket after a successful action, e.g. a successful sign-in. */
export function resetRateLimit(kind: RateLimitKey, identifier: string): void {
  buckets.delete(`${kind}:${identifier}`);
}

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;

  const maxWindow = Math.max(...Object.values(RATE_LIMITS).map((rule) => rule.windowMs));
  for (const [key, bucket] of buckets) {
    const live = bucket.hits.filter((hit) => hit > now - maxWindow);
    if (live.length === 0) buckets.delete(key);
    else bucket.hits = live;
  }
}

/** Test seam. */
export function __resetAllRateLimits(): void {
  buckets.clear();
}
