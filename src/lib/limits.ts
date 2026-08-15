/**
 * Abuse protection for the extraction endpoint.
 *
 * Two independent controls:
 *  1. Per-IP sliding limits on ALL extraction requests (protects the fetcher from being used
 *     as a scraper / open proxy). Generous for humans, hostile to scripts.
 *  2. Per-user quotas on the AI fallback only (the one path with real marginal cost).
 *     Structured extractions (JSON-LD / microdata / DOM) are free — they cost a single fetch.
 *
 * Both fail OPEN when KV is not configured (local dev) so the product still works.
 */
import { kv } from '@vercel/kv';

export const IP_LIMIT_PER_MINUTE = 20;
export const IP_LIMIT_PER_HOUR = 200;

/** Best-effort client IP behind Vercel. */
export function getClientIp(request: Request): string | null {
  const h = request.headers;
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || null;
  return h.get('x-real-ip') || h.get('cf-connecting-ip') || null;
}

function kvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * Fixed-window counters keyed by ip+minute and ip+hour. Returns { limited, retryAfterSeconds }.
 */
export async function checkIpRateLimit(ip: string | null): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  if (!ip || !kvConfigured()) return { limited: false, retryAfterSeconds: 0 };
  const now = Math.floor(Date.now() / 1000);
  const minuteKey = `rl:m:${ip}:${Math.floor(now / 60)}`;
  const hourKey = `rl:h:${ip}:${Math.floor(now / 3600)}`;
  try {
    const [m, h] = await Promise.all([kv.incr(minuteKey), kv.incr(hourKey)]);
    // Set expiry on first hit (INCR returns 1).
    const ops: Promise<unknown>[] = [];
    if (m === 1) ops.push(kv.expire(minuteKey, 120));
    if (h === 1) ops.push(kv.expire(hourKey, 7200));
    if (ops.length) await Promise.all(ops);
    if (m > IP_LIMIT_PER_MINUTE) return { limited: true, retryAfterSeconds: 60 - (now % 60) };
    if (h > IP_LIMIT_PER_HOUR) return { limited: true, retryAfterSeconds: 3600 - (now % 3600) };
    return { limited: false, retryAfterSeconds: 0 };
  } catch {
    return { limited: false, retryAfterSeconds: 0 };
  }
}
