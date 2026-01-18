import type { APIRoute } from 'astro';
import { readFileSync } from 'fs';
import { join } from 'path';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;

  try {
    const dataPath = join(process.cwd(), 'recipe-data', 'all-recipes.json');
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

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
