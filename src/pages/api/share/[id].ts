import type { APIRoute } from 'astro';
import { storage } from './index';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = storage.get(id);

  if (!data) {
    return new Response(
      JSON.stringify({ error: 'Recipe not found. The link may have expired or is invalid.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check if expired
  if (data.expiresAt < Date.now()) {
    storage.delete(id);
    return new Response(
      JSON.stringify({ error: 'This shared recipe has expired.' }),
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
};
