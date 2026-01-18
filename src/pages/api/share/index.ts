import type { APIRoute } from 'astro';
import { nanoid } from 'nanoid';
import { storeSharedRecipe, isKVConfigured } from '../../../utils/kv';

export const prerender = false;

// Fallback in-memory storage for local development
const memoryStorage = new Map<string, { recipe: any; sourceUrl: string; createdAt: number }>();

// Export for the retrieval endpoint (fallback only)
export { memoryStorage };

export const POST: APIRoute = async ({ request }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { recipe, sourceUrl } = body;

  if (!recipe) {
    return new Response(JSON.stringify({ error: 'Recipe data is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate recipe has minimum required fields
  if (!recipe.title || (!recipe.ingredients?.length && !recipe.instructions?.length)) {
    return new Response(JSON.stringify({ error: 'Invalid recipe data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Generate unique ID
  const id = nanoid(10);

  try {
    if (isKVConfigured()) {
      // Use Vercel KV for persistent storage
      await storeSharedRecipe(id, { recipe, sourceUrl });
    } else {
      // Fallback to in-memory storage for local development
      console.warn('Vercel KV not configured, using in-memory storage (will not persist)');
      memoryStorage.set(id, {
        recipe,
        sourceUrl,
        createdAt: Date.now(),
      });
    }

    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to store shared recipe:', error);
    return new Response(JSON.stringify({ error: 'Failed to create share link' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
