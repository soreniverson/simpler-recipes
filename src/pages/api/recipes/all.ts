import type { APIRoute } from 'astro';
import { readFileSync } from 'fs';
import { join } from 'path';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const dataPath = join(process.cwd(), 'recipe-data', 'all-recipes.json');
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

    // Return just the essential fields for the selector
    const recipes = data.recipes.map((r: any) => ({
      slug: r.slug,
      title: r.title,
      image: r.image,
      ingredients: r.ingredients,
      instructions: r.instructions,
      prepTime: r.prepTime,
      cookTime: r.cookTime,
      servings: r.servings,
    }));

    return new Response(JSON.stringify({ recipes }), {
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
