import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import { optimizeRemote } from '../lib/images';

/**
 * Static search index (built once per deploy). Replaces the prebuild script so each entry can
 * carry a build-optimised 96×96 thumbnail — search results and pantry matches were loading the
 * publishers' 1–2MB originals into 40px boxes.
 */
export const prerender = true;

export const GET: APIRoute = async () => {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'recipe-data', 'all-recipes.json'), 'utf-8'));
  const entries = await Promise.all(
    (data.recipes as any[]).map(async (r) => ({
      slug: r.slug,
      title: r.title,
      tags: r.tags || [],
      ingredients: r.ingredients || [],
      image: r.image || null,
      thumb: (await optimizeRemote(r.image, 96, 96, 70))?.src ?? r.image ?? null,
      totalTime: r.totalTime || null,
    }))
  );
  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
};
