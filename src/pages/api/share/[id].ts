import type { APIRoute } from 'astro';
import { getSharedRecipe, isStoreConfigured } from '../../../utils/kv';
import { memoryStorage } from './index';
import { validateRecipe, safeHref } from '../../../lib/recipe/validate';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let data: { recipe: any; sourceUrl?: string } | null = null;

    if (isStoreConfigured()) {
      // Use the server store (Redis or Supabase) for persistent storage
      const kvData = await getSharedRecipe(id);
      if (kvData) {
        data = { recipe: kvData.recipe, sourceUrl: kvData.sourceUrl };
      }
    } else if (import.meta.env.DEV) {
      // Fallback to in-memory storage for local development
      const memData = memoryStorage.get(id);
      if (memData) {
        data = { recipe: memData.recipe, sourceUrl: memData.sourceUrl ?? undefined };
      }
    }

    // Defence in depth: entries written before validation existed are re-validated on read.
    if (data) {
      const v = validateRecipe(data.recipe);
      if (!v.ok) data = null;
      else data = { recipe: v.recipe, sourceUrl: safeHref(data.sourceUrl) ?? undefined };
    }

    if (!data) {
      return new Response(
        JSON.stringify({
          error: 'Recipe not found',
          message: 'This shared recipe link is invalid or the recipe no longer exists.'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        recipe: data.recipe,
        sourceUrl: data.sourceUrl,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' },
      }
    );
  } catch (error) {
    console.error('Failed to retrieve shared recipe:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve recipe' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
