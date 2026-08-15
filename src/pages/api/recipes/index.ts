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

export const GET: APIRoute = async () => {
  try {
    const data = loadCatalog();

    // Return just collections metadata (not full recipes) for the index
    const response = {
      metadata: data.metadata,
      collections: data.collections.map((c: any) => ({
        slug: c.slug,
        name: c.name,
        description: c.description,
        recipeCount: c.recipeCount,
        recipes: c.recipes.slice(0, 5), // Preview of first 5 recipe slugs
      })),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate',
      },
    });
  } catch (error) {
    console.error('Error loading recipes:', error);
    return new Response(JSON.stringify({ error: 'Failed to load recipes' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
