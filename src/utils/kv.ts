import { kv } from '@vercel/kv';
import { createHash } from 'crypto';

// Prefixes for namespacing
const SHARE_PREFIX = 'share:';
const EXTRACT_PREFIX = 'extract:';

// TTL: 1 year in seconds (effectively permanent for most use cases)
const TTL_SECONDS = 365 * 24 * 60 * 60;

export interface SharedRecipe {
  recipe: {
    title: string;
    ingredients: string[];
    instructions: string[];
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: string;
    image?: string;
  };
  sourceUrl?: string;
  createdAt: number;
}

/**
 * Store a shared recipe in Vercel KV
 */
export async function storeSharedRecipe(id: string, data: Omit<SharedRecipe, 'createdAt'>): Promise<void> {
  const key = `${SHARE_PREFIX}${id}`;
  const payload: SharedRecipe = {
    ...data,
    createdAt: Date.now(),
  };

  await kv.set(key, payload, { ex: TTL_SECONDS });
}

/**
 * Retrieve a shared recipe from Vercel KV
 */
export async function getSharedRecipe(id: string): Promise<SharedRecipe | null> {
  const key = `${SHARE_PREFIX}${id}`;
  return await kv.get<SharedRecipe>(key);
}

/**
 * Check if KV is properly configured
 */
export function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// ============ EXTRACTION CACHING ============

// TTL: 7 days for extracted recipes
const EXTRACT_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface CachedExtraction {
  recipe: {
    title: string;
    ingredients: string[];
    instructions: string[];
    prepTime?: string | null;
    cookTime?: string | null;
    servings?: string | null;
    image?: string | null;
    source?: string;
  };
  extractedAt: number;
}

/**
 * Generate a cache key from URL
 */
function getExtractKey(url: string): string {
  const hash = createHash('sha256').update(url.toLowerCase().trim()).digest('hex').substring(0, 16);
  return `${EXTRACT_PREFIX}${hash}`;
}

/**
 * Get cached extraction result
 */
export async function getCachedExtraction(url: string): Promise<CachedExtraction | null> {
  try {
    const key = getExtractKey(url);
    return await kv.get<CachedExtraction>(key);
  } catch {
    return null;
  }
}

/**
 * Cache an extraction result
 */
export async function cacheExtraction(url: string, recipe: CachedExtraction['recipe']): Promise<void> {
  try {
    const key = getExtractKey(url);
    const payload: CachedExtraction = {
      recipe,
      extractedAt: Date.now(),
    };
    await kv.set(key, payload, { ex: EXTRACT_TTL_SECONDS });
  } catch (err) {
    console.error('Failed to cache extraction:', err);
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
 * Get usage key for a token
 */
function getUsageKey(token: string): string {
  return `${USAGE_PREFIX}${token}`;
}

/**
 * Get current usage for a token
 */
export async function getUsage(token: string): Promise<UsageData | null> {
  try {
    return await kv.get<UsageData>(getUsageKey(token));
  } catch {
    return null;
  }
}

/**
 * Increment extraction count for a token
 * Returns the new count
 */
export async function incrementExtraction(token: string): Promise<number> {
  const key = getUsageKey(token);
  const now = Date.now();

  try {
    const current = await kv.get<UsageData>(key);

    const newData: UsageData = {
      extractions: (current?.extractions || 0) + 1,
      firstExtraction: current?.firstExtraction || now,
      lastExtraction: now,
    };

    // No expiry for anonymous usage - we track lifetime
    await kv.set(key, newData);

    return newData.extractions;
  } catch (err) {
    console.error('Failed to increment extraction:', err);
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
  const usage = await getUsage(token);
  const current = usage?.extractions || 0;

  return {
    limited: current >= limit,
    current,
    limit,
    remaining: Math.max(0, limit - current),
  };
}
