import type { APIRoute } from 'astro';
import { nanoid } from 'nanoid';

export const prerender = false;

// In-memory storage for MVP
// Note: This resets on each deployment/cold start
// For production, use Vercel KV or another persistent store
const storage = new Map<string, { recipe: any; sourceUrl: string; expiresAt: number }>();

// TTL for shared recipes: 7 days
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Export storage for the retrieval endpoint
export { storage };

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

  // Store with expiration timestamp
  storage.set(id, {
    recipe,
    sourceUrl,
    expiresAt: Date.now() + TTL_MS,
  });

  // Clean up expired entries occasionally (simple garbage collection)
  if (Math.random() < 0.1) {
    const now = Date.now();
    for (const [key, value] of storage.entries()) {
      if (value.expiresAt < now) {
        storage.delete(key);
      }
    }
  }

  return new Response(JSON.stringify({ id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
