import type { APIRoute } from 'astro';
import { getSharedRecipe, isKVConfigured } from '../../../utils/kv';
import { memoryStorage } from './index';

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

    if (isKVConfigured()) {
      // Use Vercel KV for persistent storage
      const kvData = await getSharedRecipe(id);
      if (kvData) {
        data = { recipe: kvData.recipe, sourceUrl: kvData.sourceUrl };
      }
    } else {
      // Fallback to in-memory storage for local development
      const memData = memoryStorage.get(id);
      if (memData) {
        data = { recipe: memData.recipe, sourceUrl: memData.sourceUrl };
      }
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
        headers: { 'Content-Type': 'application/json' },
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
