import { createHash } from 'crypto';
import { cacheKeyForUrl } from '../lib/url';
import {
  storeGet,
  storeSet,
  isStoreConfigured,
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

// ============ USAGE TRACKING ============

const USAGE_PREFIX = 'usage:';

// Anonymous users: 3 extractions total (lifetime)
export const ANONYMOUS_EXTRACTION_LIMIT = 3;

// Authenticated users: 30 extractions per month
export const AUTHENTICATED_EXTRACTION_LIMIT = 30;

export interface UsageData {
  extractions: number;
  firstExtraction: number;
  lastExtraction: number;
}

/**
 * Usage key. Anonymous tokens are lifetime (the "3 free" promise); signed-in users get a
 * per-month key so "30 per month" is actually monthly (the old key was lifetime for everyone).
 */
function getUsageKey(token: string, isAuthenticated = false): string {
  if (!isAuthenticated) return `${USAGE_PREFIX}${token}`;
  const d = new Date();
  const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${USAGE_PREFIX}m:${token}:${period}`;
}

/**
 * Get current usage for a token. A backend failure reads as "no usage" (fails open) but
 * is logged; a wholly unconfigured store is handled by callers via isStoreConfigured().
 */
export async function getUsage(token: string, isAuthenticated = false): Promise<UsageData | null> {
  if (!isStoreConfigured()) {
    noteStoreUnavailable('quota');
    return null;
  }
  try {
    return await storeGet<UsageData>(getUsageKey(token, isAuthenticated));
  } catch (err) {
    logStoreError('quota-get', err);
    return null;
  }
}

/**
 * Increment extraction count for a token
 * Returns the new count
 */
export async function incrementExtraction(token: string, isAuthenticated = false): Promise<number> {
  if (!isStoreConfigured()) {
    noteStoreUnavailable('quota');
    return 0;
  }
  const key = getUsageKey(token, isAuthenticated);
  const now = Date.now();

  try {
    const current = await storeGet<UsageData>(key);

    const newData: UsageData = {
      extractions: (current?.extractions || 0) + 1,
      firstExtraction: current?.firstExtraction || now,
      lastExtraction: now,
    };

    // Anonymous: ~lifetime (400 days) so keys don't accumulate forever; monthly keys: 40 days.
    await storeSet(key, newData, isAuthenticated ? 40 * 24 * 3600 : 400 * 24 * 3600);

    return newData.extractions;
  } catch (err) {
    logStoreError('quota-incr', err);
    return 0;
  }
}

/**
 * Check if token has reached extraction limit
 */
export async function hasReachedLimit(token: string, isAuthenticated: boolean = false): Promise<{
  limited: boolean;
  current: number;
  limit: number;
  remaining: number;
}> {
  const limit = isAuthenticated ? AUTHENTICATED_EXTRACTION_LIMIT : ANONYMOUS_EXTRACTION_LIMIT;
  const usage = await getUsage(token, isAuthenticated);
  const current = usage?.extractions || 0;

  return {
    limited: current >= limit,
    current,
    limit,
    remaining: Math.max(0, limit - current),
  };
}
