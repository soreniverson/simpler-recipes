import type { APIRoute } from 'astro';
import { readFileSync } from 'fs';
import { join } from 'path';

export const prerender = false;

// The catalog is static per deployment; parse it once per lambda instance.
let cache: any = null;
function loadCatalog() {
  if (!cache) cache = JSON.parse(readFileSync(join(process.cwd(), 'recipe-data', 'all-recipes.json'), 'utf-8'));
  return cache;
}

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;

  try {
    const data = loadCatalog();

    const recipe = data.recipes.find((r: any) => r.slug === slug);

    if (!recipe) {
      return new Response(JSON.stringify({ error: 'Recipe not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(recipe), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate',
      },
    });
  } catch (error) {
    console.error('Error loading recipe:', error);
    return new Response(JSON.stringify({ error: 'Failed to load recipe' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
