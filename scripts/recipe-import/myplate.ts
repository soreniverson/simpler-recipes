/**
 * Import public-domain USDA MyPlate recipes.
 *
 * Provenance: USDA's MyPlate Kitchen (CNPP / SNAP-Ed) was retired 2026-01-07. The recipe
 * text is a federal work — public domain under 17 USC §105, free to reuse commercially.
 * We read the preserved data from myplate.food (whose robots.txt allows our crawler) but
 * take the PHOTOGRAPH from the original USDA CDN via the Wayback Machine, so the image is
 * the federal work itself rather than a third party's re-edit. Images are downloaded,
 * resized and committed to public/recipe-images/ — no hotlinking, no runtime dependency.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { safeFetch } from '../../src/lib/safeFetch';
import { extractRecipeFromHtml } from '../../src/lib/recipe/extract';
import { cleanIngredientLine, cleanText, stripStepNumbering, formatMinutes } from '../../src/lib/recipe/normalize';
import type { StagedRecipe } from './extract';
import { slugify } from './extract';

export const IMG_WIDTHS = [360, 520, 700, 1000];
const IMG_DIR = path.join(process.cwd(), 'public', 'recipe-images');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Prep/cook times from the ARCHIVED federal page. MyPlate's JSON-LD omits times entirely, and
 * a title like "20-Minute Chicken Creole" is not evidence — inventing a time would break the
 * catalog's rule that nothing is fabricated. These come from USDA's own rendered fields.
 */
async function archivedTimes(govSlug: string): Promise<{ prep: string | null; cook: string | null; total: string | null }> {
  const empty = { prep: null, cook: null, total: null };
  let text: string;
  try {
    const res = await safeFetch(`https://web.archive.org/web/2026/https://www.myplate.gov/recipes/${govSlug}`, { maxBytes: 8_000_000 });
    text = res.body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  } catch { return empty; }
  const grab = (label: RegExp): number | null => {
    const m = text.match(label);
    if (!m) return null;
    const h = /(\d+)\s*(?:hour|hr)/i.exec(m[1]);
    const mi = /(\d+)\s*(?:minute|min)/i.exec(m[1]);
    const mins = (h ? parseInt(h[1], 10) * 60 : 0) + (mi ? parseInt(mi[1], 10) : 0);
    return mins > 0 && mins < 24 * 60 ? mins : null;
  };
  const prep = grab(/Prep(?:aration)?\s*Time:?\s*([^A-Z]{1,40}?)(?=[A-Z]|$)/);
  const cook = grab(/Cook\s*Time:?\s*([^A-Z]{1,40}?)(?=[A-Z]|$)/);
  const total = grab(/Total\s*Time:?\s*([^A-Z]{1,40}?)(?=[A-Z]|$)/);
  return {
    prep: formatMinutes(prep), cook: formatMinutes(cook),
    total: formatMinutes(total ?? (prep != null || cook != null ? (prep || 0) + (cook || 0) : null)),
  };
}

/** The original USDA image URL as it appeared on myplate.gov, harvested from the page. */
function originalUsdaImage(html: string): string | null {
  const m = html.match(/https?:\/\/(?:myplate-prod\.azureedge\.us|www\.myplate\.gov)\/sites\/default\/files\/[^"'\s<>\\]+\.(?:jpg|jpeg|png)/i);
  return m ? m[0].replace(/\\+/g, '') : null;
}

/** Fetch the archived federal original and write WebP variants. Returns the base path or null. */
async function saveImage(usdaUrl: string, slug: string): Promise<string | null> {
  const snap = `https://web.archive.org/web/2024id_/${usdaUrl}`;
  let buf: Buffer;
  try {
    const res = await fetch(snap, { redirect: 'follow', signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return null;
    if (!/^image\//i.test(res.headers.get('content-type') || '')) return null;
    buf = Buffer.from(await res.arrayBuffer());
  } catch { return null; }
  if (buf.length < 8_000) return null; // placeholder/broken
  try {
    const meta = await sharp(buf).metadata();
    if (!meta.width || meta.width < 320) return null;
    fs.mkdirSync(IMG_DIR, { recursive: true });
    for (const w of IMG_WIDTHS) {
      await sharp(buf).resize({ width: w, height: Math.round((w * 3) / 4), fit: 'cover', position: 'centre' })
        .webp({ quality: 76 }).toFile(path.join(IMG_DIR, `${slug}-${w}.webp`));
    }
    return `/recipe-images/${slug}.webp`;
  } catch { return null; }
}

export interface ImportOpts {
  theme: string;
  extraTags?: string[];
  /** Text-only harvest: skip the image download and archived-time lookup (2 fewer requests).
      Used to survey candidates cheaply before choosing which ones to fully import. */
  light?: boolean;
}

export type MyPlateResult = { ok: true; recipe: StagedRecipe } | { ok: false; url: string; reason: string };

export async function importMyPlate(pageUrl: string, opts: ImportOpts): Promise<MyPlateResult> {
  let html: string, finalUrl: string;
  try {
    const res = await safeFetch(pageUrl, { maxBytes: 4_000_000 });
    html = res.body; finalUrl = res.url;
  } catch (e: any) { return { ok: false, url: pageUrl, reason: `fetch:${e.code || e.message}` }; }

  const out = extractRecipeFromHtml(html, finalUrl);
  const r = out.recipe;
  if (!r) return { ok: false, url: pageUrl, reason: 'no-recipe-data' };
  if (out.method !== 'jsonld' && out.method !== 'microdata') return { ok: false, url: pageUrl, reason: `method:${out.method}` };

  const title = cleanText(r.title);
  const slug = slugify(title);
  if (!slug) return { ok: false, url: pageUrl, reason: 'no-slug' };

  const usda = originalUsdaImage(html);
  if (!usda) return { ok: false, url: pageUrl, reason: 'no-usda-original-image' };
  const govPathEarly = (finalUrl.match(/\/recipes\/([a-z0-9\-]+)/i) || [])[1];

  let image: string | null;
  let times = { prep: null as string | null, cook: null as string | null, total: null as string | null };
  if (opts.light) {
    image = usda; // provisional: the real download happens in the full pass
  } else {
    image = await saveImage(usda, slug);
    if (!image) return { ok: false, url: pageUrl, reason: 'image-unavailable' };
    await sleep(400); // polite to the archive
    times = govPathEarly ? await archivedTimes(govPathEarly) : times;
    await sleep(400);
  }

  const ingredients = r.ingredients.map((i) => cleanIngredientLine(i)).filter(Boolean);
  const instructions = r.instructions.map((s) => stripStepNumbering(cleanText(s))).filter(Boolean);
  const totalMin = r.totalMinutes ?? null;
  const govPath = (finalUrl.match(/\/recipes\/([a-z0-9\-]+)/i) || [])[1];

  return {
    ok: true,
    recipe: {
      id: slug, slug, title, image,
      prepTime: times.prep, cookTime: times.cook, totalTime: times.total,
      servings: r.servings, ingredients, instructions,
      tags: [...new Set([...(opts.extraTags || []), 'usda', 'public-domain'])].slice(0, 6),
      // Provenance points at the archived federal page, which is permanent and live.
      source: { name: 'USDA MyPlate', url: govPath ? `https://web.archive.org/web/2026/https://www.myplate.gov/recipes/${govPath}` : finalUrl },
      theme: opts.theme,
      difficulty: (totalMin != null && totalMin <= 30 && instructions.length <= 6) || ingredients.length <= 6 ? 'Easy' : 'Medium',
      addedDate: new Date().toISOString(),
    },
  };
}
