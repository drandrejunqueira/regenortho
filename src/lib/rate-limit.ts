// In-memory sliding-window rate limiter.
//
// NOTE: state lives in the function instance memory. On serverless with
// multiple concurrent instances this is a best-effort first layer — most
// sustained brute-force traffic hits the same warm instance and gets capped.
// For hard, cluster-wide guarantees, back this with a shared store
// (Upstash Redis / Vercel KV) using the same interface.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Occasionally evict expired buckets so memory stays bounded.
let lastSweep = Date.now()
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSec: number
}

/**
 * Fixed-window rate limit. Returns ok=false once `limit` is exceeded within
 * `windowMs`, with `retryAfterSec` until the window resets.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 }
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) }
  }

  existing.count += 1
  return { ok: true, remaining: limit - existing.count, retryAfterSec: 0 }
}

/** Extract the best-effort client IP from a request behind Vercel's proxy. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
