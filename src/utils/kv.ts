import { kv } from '@vercel/kv';

// Prefix for share keys to namespace them
const SHARE_PREFIX = 'share:';

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
