/**
 * Simple in-memory sliding-window rate limiter.
 * Works per-process; effective for burst protection even in serverless.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory leaks (every 60s)
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const ensureCleanup = () => {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, 60_000);
  // Don't hold the process open
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
};

/**
 * Check if a request is rate-limited.
 * @param key - Unique identifier (e.g., userId, IP)
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Time window in milliseconds
 * @returns { limited: boolean, remaining: number, resetAt: number }
 */
export const checkRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number,
): { limited: boolean; remaining: number; resetAt: number } => {
  ensureCleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { limited: true, remaining: 0, resetAt: entry.resetAt };
  }

  return { limited: false, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
};
