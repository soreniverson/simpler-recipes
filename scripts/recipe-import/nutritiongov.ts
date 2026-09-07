/**
 * Import recipes from Nutrition.gov (USDA National Agricultural Library).
 *
 * PROVENANCE IS THE POINT. A .gov URL does not make a recipe a federal work: Nutrition.gov
 * republishes a large amount of state-university Extension and industry-board material, which
 * is copyrighted by those bodies and is NOT covered by 17 USC §105. Every recipe here is
 * therefore gated on its own machine-readable `creator`, and any photo that looks like
 * licensed stock is rejected outright — USDA may hold a stock licence, but we don't.
 *
 * Ingredients are parsed from the HTML body on purpose: the page's JSON-LD `recipeIngredient`
 * is lossy (it emits "2 large" and drops "eggs"), which would silently corrupt the catalog.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { parseDocument } from 'htmlparser2';
import { selectAll, selectOne } from 'css-select';
import { textContent } from 'domutils';
import { safeFetch } from '../../src/lib/safeFetch';
import { cleanIngredientLine, cleanText, stripStepNumbering, formatMinutes } from '../../src/lib/recipe/normalize';
import { slugify, type StagedRecipe } from './extract';

export const IMG_WIDTHS = [360, 520, 700, 1000];
const IMG_DIR = path.join(process.cwd(), 'public', 'recipe-images');

/** Federal authors whose work is public domain under 17 USC §105. */
const FEDERAL = /\b(USDA|U\.?S\.? Department of Agriculture|National Agricultural Library|MyPlate|Center for Nutrition Policy|CNPP|Food and Nutrition Service|Team Nutrition|WIC|SNAP-Ed Connection|National Institutes of Health|NIH|National Heart, Lung|NHLBI|Agricultural Research Service|Dietary Guidelines|Department of Veterans Affairs)\b/i;
/** Bodies that are NOT federal even when a federal site hosts them. */
const NOT_FEDERAL = /\b(University|Universities|Extension|College|State of|Board|Council|Foundation|Association|Institute of Child Nutrition|Peace Corps|Commission|Dairy|Beef|Pork|Egg Board|CalFresh|Department of Public Health)\b/i;
/** Licensed stock imagery: USDA's licence does not travel with the picture. */
const STOCK = /(adobestock|istock|shutterstock|gettyimages|\bstock\b)/i;

const tidy = (s: string) => cleanText(s.replace(/ /g, ' ')).trim();
const textOf = (n: unknown) => (n ? tidy(textContent(n as any)) : '');

/** "<sup>1</sup>/<sub>4</sub> large" -> "1/4 large" */
function fractions(html: string): string {
  return html.replace(/<sup>(\d+)<\/sup>\s*\/\s*<sub>(\d+)<\/sub>/gi, '$1/$2');
}

function minutesFrom(s: string): number | null {
  const h = /(\d+)\s*(?:hours?|hrs?)/i.exec(s); const m = /(\d+)\s*(?:minutes?|mins?)/i.exec(s);
  const n = (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
  return n > 0 && n < 24 * 60 ? n : null;
}

async function saveImage(url: string, slug: string): Promise<string | null> {
  const done = IMG_WIDTHS.every((w) => fs.existsSync(path.join(IMG_DIR, `${slug}-${w}.webp`)));
  if (done) return `/recipe-images/${slug}.webp`;
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(45_000) });
    if (!res.ok || !/^image\//i.test(res.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8_000) return null;
    const meta = await sharp(buf).metadata();
    if (!meta.width || meta.width < 400) return null;
    fs.mkdirSync(IMG_DIR, { recursive: true });
    for (const w of IMG_WIDTHS) {
      await sharp(buf).resize({ width: w, height: Math.round((w * 3) / 4), fit: 'cover', position: 'attention' })
        .webp({ quality: 76 }).toFile(path.join(IMG_DIR, `${slug}-${w}.webp`));
    }
    return `/recipe-images/${slug}.webp`;
  } catch { return null; }
}

export type NgResult = { ok: true; recipe: StagedRecipe; creator: string } | { ok: false; url: string; reason: string };

export async function importNutritionGov(pageUrl: string, opts: { theme: string; light?: boolean }): Promise<NgResult> {
  let html: string, finalUrl: string;
  try { const r = await safeFetch(pageUrl, { maxBytes: 4_000_000 }); html = r.body; finalUrl = r.url; }
  catch (e: any) { return { ok: false, url: pageUrl, reason: `fetch:${e.code || e.message}` }; }

  // --- structured data: identity, photo, steps ---
  let ld: any = null;
  for (const b of [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])) {
    try { const d = JSON.parse(b); const arr = Array.isArray(d) ? d : d['@graph'] || [d];
      for (const n of arr) if (String(n['@type']).includes('Recipe')) ld = n; } catch { /* skip */ }
  }
  if (!ld) return { ok: false, url: pageUrl, reason: 'no-jsonld-recipe' };

  const creator = String(ld.creator?.name || ld.author?.name || '').trim();
  if (!creator) return { ok: false, url: pageUrl, reason: 'no-creator' };
  if (NOT_FEDERAL.test(creator) || !FEDERAL.test(creator)) return { ok: false, url: pageUrl, reason: `not-federal:${creator.slice(0, 60)}` };

  const imgUrl = Array.isArray(ld.image) ? (ld.image[0]?.url || ld.image[0]) : (ld.image?.url || ld.image);
  if (!imgUrl) return { ok: false, url: pageUrl, reason: 'no-image' };
  if (STOCK.test(String(imgUrl))) return { ok: false, url: pageUrl, reason: 'stock-image' };

  const title = tidy(ld.name || '');
  const slug = slugify(title);
  if (!slug) return { ok: false, url: pageUrl, reason: 'no-slug' };

  // --- HTML body: ingredients (the JSON-LD copy is lossy) and times ---
  const doc = parseDocument(fractions(html));
  // The ingredient block nests: an outer .field--name-ingredients wrapper contains a paragraph
  // which contains the real rows. Selecting the outer one too yields every line twice.
  const ingredients = selectAll('.field--type-ingredient > .field__item', doc)
    .map((el) => {
      const q = textOf(selectOne('.quantity-unit', el));
      const n = textOf(selectOne('.ingredient-name', el));
      return n ? cleanIngredientLine(`${q} ${n}`.trim()) : '';
    })
    .filter(Boolean);
  if (ingredients.length < 3) return { ok: false, url: pageUrl, reason: `too-few-ingredients:${ingredients.length}` };

  const timeOf = (cls: string) => {
    const el = selectOne(`.field--name-recipe-${cls} .field__item`, doc);
    return el ? minutesFrom(textOf(el)) : null;
  };
  const prep = timeOf('prep-time'), cook = timeOf('cook-time');
  let total = timeOf('total-time');
  if (total == null && (prep != null || cook != null)) total = (prep || 0) + (cook || 0);

  // Steps: the JSON-LD concatenates them without separators, so prefer the rendered list.
  let instructions = selectAll('.field--name-recipe-instructions li, .field--name-field-instructions li', doc)
    .map((li) => stripStepNumbering(textOf(li))).filter((s) => s.length > 2);
  if (instructions.length < 2) {
    const raw = (ld.recipeInstructions || []).map((s: any) => (typeof s === 'string' ? s : s.text || '')).join(' ');
    instructions = tidy(raw).split(/(?<=[a-z0-9)\]"'.])\.(?=[A-Z])/).map((s) => stripStepNumbering(tidy(s.endsWith('.') ? s : s + '.'))).filter((s) => s.length > 4);
  }
  if (instructions.length < 2) return { ok: false, url: pageUrl, reason: 'too-few-steps' };

  const image = opts.light ? String(imgUrl) : await saveImage(String(imgUrl), slug);
  if (!image) return { ok: false, url: pageUrl, reason: 'image-unavailable' };

  const yieldTxt = Array.isArray(ld.recipeYield) ? ld.recipeYield[0] : ld.recipeYield;

  return {
    ok: true, creator,
    recipe: {
      id: slug, slug, title, image,
      prepTime: formatMinutes(prep), cookTime: formatMinutes(cook), totalTime: formatMinutes(total),
      servings: yieldTxt ? tidy(String(yieldTxt)) : null,
      ingredients, instructions,
      tags: ['public-domain'],
      source: { name: 'Nutrition.gov (USDA)', url: finalUrl },
      theme: opts.theme,
      difficulty: (total != null && total <= 30 && instructions.length <= 6) || ingredients.length <= 6 ? 'Easy' : 'Medium',
      addedDate: new Date().toISOString(),
    },
  };
}
