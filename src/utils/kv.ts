import { createHash } from 'crypto';
import { cacheKeyForUrl } from '../lib/url';
import {
  storeGet,
  storeSet,
  storeIncr,
  storeDecr,
  isStoreConfigured,
  isProdRuntime,
  logStoreError,
  noteStoreUnavailable,
} from '../lib/serverStore';
import type { Recipe } from '../lib/recipe/types';

// Backend selection (Redis vs Supabase) lives in src/lib/serverStore.ts.
export { isStoreConfigured };

// Prefixes for namespacing
const SHARE_PREFIX = 'share:';
const EXTRACT_PREFIX = 'extract:';

// TTL: 1 year in seconds (effectively permanent for most use cases)
const TTL_SECONDS = 365 * 24 * 60 * 60;

export interface SharedRecipe {
  recipe: Recipe;
  sourceUrl?: string;
  createdAt: number;
}

/**
 * Store a shared recipe. Throws on failure — the share endpoint turns that into a 500
 * instead of handing out a link that resolves to nothing.
 */
export async function storeSharedRecipe(id: string, data: Omit<SharedRecipe, 'createdAt'>): Promise<void> {
  const key = `${SHARE_PREFIX}${id}`;
  const payload: SharedRecipe = {
    ...data,
    createdAt: Date.now(),
  };

  await storeSet(key, payload, TTL_SECONDS);
}

/**
 * Retrieve a shared recipe. Throws on backend failure (callers already catch and 404/500).
 */
export async function getSharedRecipe(id: string): Promise<SharedRecipe | null> {
  const key = `${SHARE_PREFIX}${id}`;
  return await storeGet<SharedRecipe>(key);
}

// ============ EXTRACTION CACHING ============

// TTL: 7 days for extracted recipes
const EXTRACT_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface CachedExtraction {
  recipe: Recipe;
  extractedAt: number;
  /** Cache schema version — bump to invalidate everything cached by an older parser. */
  v?: number;
}

/** Bump when the parser output shape/quality changes materially. */
export const EXTRACT_CACHE_VERSION = 2;

/**
 * Generate a cache key from a URL. Uses the canonical form so `?utm_source=`,
 * trailing slashes, `www.` and http/https variants share one entry.
 */
function getExtractKey(url: string): string {
  const hash = createHash('sha256').update(cacheKeyForUrl(url)).digest('hex').substring(0, 16);
  return `${EXTRACT_PREFIX}v${EXTRACT_CACHE_VERSION}:${hash}`;
}

/**
 * Get cached extraction result. Fails open (cache miss), loudly.
 */
export async function getCachedExtraction(url: string): Promise<CachedExtraction | null> {
  if (!isStoreConfigured()) {
    noteStoreUnavailable('cache');
    return null;
  }
  try {
    return await storeGet<CachedExtraction>(getExtractKey(url));
  } catch (err) {
    logStoreError('cache-get', err);
    return null;
  }
}

/**
 * Cache an extraction result. Fails open, loudly.
 */
export async function cacheExtraction(url: string, recipe: CachedExtraction['recipe']): Promise<void> {
  if (!isStoreConfigured()) return; // local dev: no cache, no stack trace per extraction
  try {
    const payload: CachedExtraction = {
      recipe,
      extractedAt: Date.now(),
      v: EXTRACT_CACHE_VERSION,
    };
    await storeSet(getExtractKey(url), payload, EXTRACT_TTL_SECONDS);
  } catch (err) {
    logStoreError('cache-set', err);
  }
}

// ============ AI QUOTAS (reserve-then-spend) ============
//
// The AI fallback and remix cost real money per call, so the quota is a RESERVATION
// taken atomically BEFORE the Anthropic call (no check-then-spend race, no lost
// updates under parallel requests) and refunded only when the call itself failed.
// A call that ran but found no recipe stays charged — Anthropic billed us either way.
//
// Two independent counters, both must clear:
//  - per-identity: 3 lifetime (anonymous cookie token) / 30 per month (user id).
//  - per-IP daily: the anonymous token is client-supplied and rotatable, so the IP
//    cap is what actually bounds an attacker; the token quota is honest-user UX.
//
// In production, a store that is missing OR erroring refuses the reservation
// (fail closed): unmetered AI spend is worse than a temporarily disabled fallback.

// Counters are plain integers (atomic incr/decr on both backends). The 'uc:'/'aiip:'
// prefixes are new — the old 'usage:' keys held JSON blobs incr can't touch.
const USAGE_PREFIX = 'uc:';
const IP_DAY_PREFIX = 'aiip:';

// Anonymous users: 3 extractions total (lifetime)
export const ANONYMOUS_EXTRACTION_LIMIT = 3;

// Authenticated users: 30 extractions per month
export const AUTHENTICATED_EXTRACTION_LIMIT = 30;

// Any single IP: at most this many AI calls per UTC day, signed in or not.
// Generous for households/offices behind NAT; hostile to cookie-rotating scripts.
export const AI_IP_DAILY_LIMIT = 25;

/**
 * Usage key. Anonymous tokens are lifetime (the "3 free" promise); signed-in users get a
 * per-month key so "30 per month" is actually monthly.
 */
function getUsageKey(token: string, isAuthenticated = false): string {
  if (!isAuthenticated) return `${USAGE_PREFIX}${token}`;
  const d = new Date();
  const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${USAGE_PREFIX}m:${token}:${period}`;
}

function getIpDayKey(ip: string): string {
  const d = new Date();
  const day = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${IP_DAY_PREFIX}${ip}:${day}`;
}

// Anonymous: ~lifetime (400 days) so keys don't accumulate forever; monthly keys: 40 days;
// per-IP day keys: 2 days.
const usageTtl = (isAuthenticated: boolean) => (isAuthenticated ? 40 * 24 * 3600 : 400 * 24 * 3600);
const IP_DAY_TTL = 2 * 24 * 3600;

export type AiReservation =
  | { ok: true; current: number; limit: number; remaining: number }
  | { ok: false; reason: 'quota' | 'ip-quota' | 'unavailable'; current: number; limit: number };

/**
 * Atomically reserve one AI call. Call BEFORE hitting Anthropic; on a thrown Anthropic
 * call, give the slot back with refundAiUse(). Fails open only in dev without a store.
 */
export async function reserveAiUse(
  token: string | null,
  isAuthenticated: boolean,
  ip: string | null
): Promise<AiReservation> {
  const limit = isAuthenticated ? AUTHENTICATED_EXTRACTION_LIMIT : ANONYMOUS_EXTRACTION_LIMIT;

  if (!isStoreConfigured()) {
    noteStoreUnavailable('quota');
    if (isProdRuntime()) return { ok: false, reason: 'unavailable', current: 0, limit };
    return { ok: true, current: 0, limit, remaining: limit }; // local dev
  }

  try {
    // IP cap first: it's the layer that holds when the token is rotated or absent.
    if (ip) {
      const ipCount = await storeIncr(getIpDayKey(ip), IP_DAY_TTL);
      if (ipCount > AI_IP_DAILY_LIMIT) {
        // Leave the over-limit increment in place — it keeps 'limited' true and costs nothing.
        return { ok: false, reason: 'ip-quota', current: limit, limit };
      }
    }

    if (!token) return { ok: true, current: 0, limit, remaining: limit }; // IP cap was the only gate

    const n = await storeIncr(getUsageKey(token, isAuthenticated), usageTtl(isAuthenticated));
    if (n > limit) {
      // No AI call will happen: put both counters back so displays stay truthful.
      await storeDecr(getUsageKey(token, isAuthenticated)).catch(() => {});
      if (ip) await storeDecr(getIpDayKey(ip)).catch(() => {});
      return { ok: false, reason: 'quota', current: limit, limit };
    }
    return { ok: true, current: n, limit, remaining: Math.max(0, limit - n) };
  } catch (err) {
    logStoreError('quota-reserve', err);
    // A dying store must not mean unmetered spend: refuse the metered path in prod.
    if (isProdRuntime()) return { ok: false, reason: 'unavailable', current: 0, limit };
    return { ok: true, current: 0, limit, remaining: limit };
  }
}

/**
 * Return a reserved slot after an AI call that never completed (thrown API error).
 * Best-effort: a failed refund only over-counts, never under-counts.
 */
export async function refundAiUse(token: string | null, isAuthenticated: boolean, ip: string | null): Promise<void> {
  if (!isStoreConfigured()) return;
  try {
    if (token) await storeDecr(getUsageKey(token, isAuthenticated));
    if (ip) await storeDecr(getIpDayKey(ip));
  } catch (err) {
    logStoreError('quota-refund', err);
  }
}
