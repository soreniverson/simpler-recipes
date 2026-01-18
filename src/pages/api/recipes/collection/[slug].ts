import type { APIRoute } from 'astro';
import { readFileSync } from 'fs';
import { join } from 'path';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;

  try {
    const dataPath = join(process.cwd(), 'recipe-data', `${slug}.json`);
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate',
      },
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return new Response(JSON.stringify({ error: 'Collection not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Error loading collection:', error);
    return new Response(JSON.stringify({ error: 'Failed to load collection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
