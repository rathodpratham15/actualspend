import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Build a single Ratelimit instance lazily so the absence of Upstash env vars
// doesn't crash the import (dev / preview environments often won't have them).
// If unconfigured, the limiter is null and check() degrades to "always allow".
//
// To enable: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
// Upstash's free tier covers ~10k commands/day which is plenty for this app.

let limiter: Ratelimit | null | undefined;

function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    limiter = null;
    return null;
  }
  limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    // 30 requests per 60 seconds per key. Generous enough for normal use,
    // tight enough to slow a bad actor hammering /api/reconcile.
    limiter: Ratelimit.slidingWindow(30, "60 s"),
    analytics: false,
    prefix: "as_rl",
  });
  return limiter;
}

export type RateLimitResult = {
  ok: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
};

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const lim = getLimiter();
  if (!lim) return { ok: true };
  try {
    const { success, limit, remaining, reset } = await lim.limit(key);
    return { ok: success, limit, remaining, reset };
  } catch (err) {
    // Upstash quota exhausted, network error, etc. — fail open so the app
    // stays functional. Log so it's visible in Sentry / Vercel logs.
    console.error("[rate-limit] Upstash error, failing open:", err);
    return { ok: true };
  }
}

// Convenience: returns a 429 Response when limit hit, otherwise null. Use:
//   const rl = await rateLimitOrReject(`reconcile:${userId}`);
//   if (rl) return rl;
export async function rateLimitOrReject(
  key: string,
): Promise<Response | null> {
  const r = await checkRateLimit(key);
  if (r.ok) return null;
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: "Too many requests. Try again shortly.",
      retryAfterSeconds: r.reset
        ? Math.max(1, Math.ceil((r.reset - Date.now()) / 1000))
        : 60,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": r.reset
          ? String(Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)))
          : "60",
      },
    },
  );
}
