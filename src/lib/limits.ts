/**
 * Abuse protection for the extraction endpoint.
 *
 * Two independent controls:
 *  1. Per-IP sliding limits on ALL extraction requests (protects the fetcher from being used
 *     as a scraper / open proxy). Generous for humans, hostile to scripts.
 *  2. Per-user quotas on the AI fallback only (the one path with real marginal cost).
 *     Structured extractions (JSON-LD / microdata / DOM) are free — they cost a single fetch.
 *
 * Both fail OPEN when no server store is configured (local dev) so the product still works —
 * but in production that state is logged (see serverStore.ts), and the AI-quota callers
 * additionally fail closed there because unmetered AI calls bill real money.
 */
import { storeIncr, isStoreConfigured, logStoreError, noteStoreUnavailable } from './serverStore';

export const IP_LIMIT_PER_MINUTE = 20;
export const IP_LIMIT_PER_HOUR = 200;

/** Best-effort client IP behind Vercel. */
export function getClientIp(request: Request): string | null {
  const h = request.headers;
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || null;
  return h.get('x-real-ip') || h.get('cf-connecting-ip') || null;
}

/**
 * Fixed-window counters keyed by ip+minute and ip+hour. Returns { limited, retryAfterSeconds }.
 */
export async function checkIpRateLimit(ip: string | null): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  if (!ip) return { limited: false, retryAfterSeconds: 0 };
  if (!isStoreConfigured()) {
    noteStoreUnavailable('rate-limit');
    return { limited: false, retryAfterSeconds: 0 };
  }
  const now = Math.floor(Date.now() / 1000);
  const minuteKey = `rl:m:${ip}:${Math.floor(now / 60)}`;
  const hourKey = `rl:h:${ip}:${Math.floor(now / 3600)}`;
  try {
    // TTLs run past the window (120s / 7200s) so a straggling request can't resurrect a key.
    const [m, h] = await Promise.all([storeIncr(minuteKey, 120), storeIncr(hourKey, 7200)]);
    if (m > IP_LIMIT_PER_MINUTE) return { limited: true, retryAfterSeconds: 60 - (now % 60) };
    if (h > IP_LIMIT_PER_HOUR) return { limited: true, retryAfterSeconds: 3600 - (now % 3600) };
    return { limited: false, retryAfterSeconds: 0 };
  } catch (err) {
    logStoreError('rate-limit', err);
    return { limited: false, retryAfterSeconds: 0 };
  }
}
