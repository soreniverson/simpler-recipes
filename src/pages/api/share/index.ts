import type { APIRoute } from 'astro';
import { nanoid } from 'nanoid';
import { storeSharedRecipe, isStoreConfigured } from '../../../utils/kv';
import { validateRecipe, safeHref, MAX_SHARE_BYTES } from '../../../lib/recipe/validate';
import { checkIpRateLimit, getClientIp } from '../../../lib/limits';

export const prerender = false;

// Fallback in-memory storage for local development ONLY (never persists across cold starts).
const memoryStorage = new Map<string, { recipe: any; sourceUrl: string | null; createdAt: number }>();
export { memoryStorage };

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });

export const POST: APIRoute = async ({ request }) => {
  // Abuse guard: share creates a stored, public object.
  const rate = await checkIpRateLimit(getClientIp(request));
  if (rate.limited) return json({ error: 'Too many requests. Please slow down.' }, 429, { 'Retry-After': String(rate.retryAfterSeconds) });

  // Size guard before parsing.
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_SHARE_BYTES) return json({ error: 'Recipe is too large to share.' }, 413);

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (raw.length > MAX_SHARE_BYTES) return json({ error: 'Recipe is too large to share.' }, 413);

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body || typeof body !== 'object' || !body.recipe) return json({ error: 'Recipe data is required' }, 400);

  const validated = validateRecipe(body.recipe);
  if (!validated.ok) return json({ error: `Invalid recipe data (${validated.error})` }, 400);
  const recipe = validated.recipe;
  const sourceUrl = safeHref(body.sourceUrl ?? recipe.sourceUrl) ?? null;
  if (sourceUrl) recipe.sourceUrl = sourceUrl;

  const id = nanoid(10);
  try {
    if (isStoreConfigured()) {
      await storeSharedRecipe(id, { recipe, sourceUrl: sourceUrl ?? undefined });
    } else if (import.meta.env.DEV) {
      memoryStorage.set(id, { recipe, sourceUrl, createdAt: Date.now() });
    } else {
      // Production without a store: fail loudly instead of handing out links that die on the next cold start.
      return json({ error: 'Sharing is temporarily unavailable.' }, 503);
    }
    return json({ id });
  } catch (error) {
    console.error('Failed to store shared recipe:', error);
    return json({ error: 'Failed to create share link' }, 500);
  }
};
