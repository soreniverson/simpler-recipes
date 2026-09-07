/**
 * Import recipes from the NSW Government healthy-eating collection.
 *
 * Licence: "All material on this website is licensed under the Creative Commons Attribution
 * 4.0 licence, except as noted below." (https://www.nsw.gov.au/copyright). The exclusions are
 * the State's Coat of Arms/logos, expressly-marked third-party material, and NESA content —
 * photographs are NOT carved out, unlike almost every other public-sector collection. Required
 * attribution: "© State of New South Wales. For current information go to www.nsw.gov.au".
 *
 * CC BY 4.0 permits commercial use, so unlike the CC BY-SA sources there is no share-alike
 * obligation on our pages — only attribution, which we record on every recipe.
 *
 * The pages carry no Recipe JSON-LD, so this parses the rendered article: "At a glance"
 * (prep time / difficulty / serves) followed by <h2>Ingredients</h2> and <h2>Steps</h2>.
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

export const ATTRIBUTION = '© State of New South Wales. For current information go to www.nsw.gov.au';
const IMG_WIDTHS = [360, 520, 700, 1000];
const IMG_DIR = path.join(process.cwd(), 'public', 'recipe-images');
const STOCK = /(adobestock|istock|shutterstock|gettyimages)/i;

const tidy = (s: string) => cleanText(s.replace(/ /g, ' ')).trim();
const textOf = (n: unknown) => (n ? tidy(textContent(n as any)) : '');

function minutesFrom(s: string): number | null {
  const h = /(\d+)\s*(?:hours?|hrs?)/i.exec(s); const m = /(\d+)\s*(?:minutes?|mins?)/i.exec(s);
  const n = (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
  return n > 0 && n < 24 * 60 ? n : null;
}

async function saveImage(url: string, slug: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(45_000) });
    if (!res.ok || !/^image\//i.test(res.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 6_000) return null;
    const meta = await sharp(buf).metadata();
    if (!meta.width || meta.width < 400) return null;
    fs.mkdirSync(IMG_DIR, { recursive: true });
    for (const w of IMG_WIDTHS) {
      await sharp(buf).resize({ width: w, height: Math.round((w * 3) / 4), fit: 'cover', position: 'attention' })
        .webp({ quality: 76 }).toFile(path.join(IMG_DIR, `${slug}-${w}.webp`));
    }
    // Also write the bare <slug>.webp: it is what the catalog stores and what social/schema
    // metadata resolves to, so it must exist as a real file, not only as width variants.
    await sharp(buf).resize({ width: 1000, height: 750, fit: 'cover', position: 'attention' })
      .webp({ quality: 76 }).toFile(path.join(IMG_DIR, `${slug}.webp`)); // base copy
    return `/recipe-images/${slug}.webp`;
  } catch { return null; }
}

/** Collect <li> items that follow a given <h2> until the next <h2>. */
function sectionItems(doc: any, headingRe: RegExp): string[] {
  for (const h of selectAll('h2', doc)) {
    if (!headingRe.test(textOf(h))) continue;
    const out: string[] = [];
    let n: any = h.next;
    while (n) {
      if (n.name === 'h2') break;
      if (n.name === 'ul' || n.name === 'ol') for (const li of selectAll('li', n)) out.push(textOf(li));
      n = n.next;
    }
    if (out.length) return out;
  }
  return [];
}

export type NswResult = { ok: true; recipe: StagedRecipe } | { ok: false; url: string; reason: string };

export async function importNsw(pageUrl: string, opts: { theme: string; light?: boolean }): Promise<NswResult> {
  let html: string, finalUrl: string;
  try { const r = await safeFetch(pageUrl, { maxBytes: 4_000_000 }); html = r.body; finalUrl = r.url; }
  catch (e: any) { return { ok: false, url: pageUrl, reason: `fetch:${e.code || e.message}` }; }

  if (STOCK.test(html)) return { ok: false, url: pageUrl, reason: 'stock-image-credit' };

  const doc = parseDocument(html);
  const title = tidy((html.match(/<meta property="og:title" content="([^"]+)"/i) || [])[1] || textOf(selectOne('h1', doc)))
    .replace(/\s*\|\s*NSW Government\s*$/i, '');
  const slug = slugify(title);
  if (!slug) return { ok: false, url: pageUrl, reason: 'no-title' };

  const ingredients = sectionItems(doc, /^ingredients/i).map((s) => cleanIngredientLine(s)).filter(Boolean);
  if (ingredients.length < 3) return { ok: false, url: pageUrl, reason: `too-few-ingredients:${ingredients.length}` };
  const instructions = sectionItems(doc, /^(steps|method|directions)/i).map((s) => stripStepNumbering(s)).filter((s) => s.length > 3);
  if (instructions.length < 2) return { ok: false, url: pageUrl, reason: 'too-few-steps' };

  // "At a glance": Preparation time: 15 minutes / Difficulty: Easy / Serves: 4
  // 'At a glance' lives in one of several wysiwyg blocks; scan them all as one string.
  const glance = selectAll('.nsw-wysiwyg-content', doc).map((n) => textOf(n)).join(' ');
  // Capture up to the next known label. (A negated class like [^A-Z] with the /i flag also
  // excludes lowercase, which silently truncated "15 minutes" to "15".)
  const NEXT = '(?=Difficulty|Serves|Cook|Preparation|Ingredients|Steps|Method|$)';
  const prep = (glance.match(new RegExp(`Preparation time:\\s*(.{1,30}?)${NEXT}`, 'i')) || [])[1];
  const cook = (glance.match(new RegExp(`Cook(?:ing)? time:\\s*(.{1,30}?)${NEXT}`, 'i')) || [])[1];
  const serves = (glance.match(/Serves:\s*([0-9]{1,3}(?:\s*-\s*[0-9]{1,3})?)/i) || [])[1];
  const diff = (glance.match(/Difficulty:\s*(Easy|Medium|Hard)/i) || [])[1];
  const prepM = prep ? minutesFrom(prep) : null;
  const cookM = cook ? minutesFrom(cook) : null;
  const totalM = prepM != null || cookM != null ? (prepM || 0) + (cookM || 0) : null;

  const imgUrl = (html.match(/<meta property="og:image" content="([^"]+)"/i) || [])[1];
  if (!imgUrl) return { ok: false, url: pageUrl, reason: 'no-image' };
  const image = opts.light ? imgUrl : await saveImage(imgUrl.replace(/\?itok=.*$/, ''), slug);
  if (!image) return { ok: false, url: pageUrl, reason: 'image-unavailable' };

  return {
    ok: true,
    recipe: {
      id: slug, slug, title, image,
      prepTime: formatMinutes(prepM), cookTime: formatMinutes(cookM), totalTime: formatMinutes(totalM),
      servings: serves ? `${serves.trim()} servings` : null,
      ingredients, instructions,
      tags: ['cc-by'],
      source: { name: 'NSW Government', url: finalUrl },
      theme: opts.theme,
      difficulty: diff && /hard|medium/i.test(diff) ? 'Medium' : 'Easy',
      addedDate: new Date().toISOString(),
    },
  };
}
