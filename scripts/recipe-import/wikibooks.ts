/**
 * Import Indian recipes from the Wikibooks Cookbook.
 *
 * Licence: recipe text is CC BY-SA 4.0 (Wikimedia Terms of Use). That permits commercial use
 * but is COPYLEFT — reproducing the ingredients and method makes our page a derivative, so
 * each imported recipe records its licence and a link back, and the recipe page displays it.
 *
 * Photographs are a separate grant. Every image lives on Wikimedia Commons, whose licensing
 * policy requires that "Commercial use of the work must be allowed" and refuses NC-only media,
 * so Commons files are commercially safe by policy — but each carries its OWN licence and
 * usually requires attributing a named author. We therefore resolve licence + artist per file
 * from the Commons API, store them, and reject anything that isn't clearly commercial-friendly.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { safeFetch } from '../../src/lib/safeFetch';
import { cleanIngredientLine, cleanText, stripStepNumbering, formatMinutes } from '../../src/lib/recipe/normalize';
import { slugify, type StagedRecipe } from './extract';

const IMG_WIDTHS = [360, 520, 700, 1000];
const IMG_DIR = path.join(process.cwd(), 'public', 'recipe-images');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Commons refuses NC/ND media, but verify rather than trust: only these are acceptable. */
const OK_LICENCE = /^(cc0|cc by(-sa)? ?\d|public domain|pd|copyrighted free use|attribution)/i;
const BAD_LICENCE = /(non[- ]?commercial|\bnc\b|\bnd\b|no ?deriv|fair use)/i;

async function api(host: string, params: Record<string, string>): Promise<any> {
  const r = await safeFetch(`https://${host}/w/api.php?format=json&` + new URLSearchParams(params).toString(), { maxBytes: 8_000_000 });
  return JSON.parse(r.body);
}

/** Strip wiki markup down to plain prose. */
function unwiki(s: string): string {
  return s
    .replace(/<ref[^>]*\/>/gi, ' ')
    .replace(/<ref[\s\S]*?<\/ref>/gi, ' ')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, ' ')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1') // [[Cookbook:Tomato|tomatoes]] -> tomatoes
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/'''?([^']*)'''?/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Items under a heading, continuing through deeper sub-headings.
 *
 * Indian recipes very often group their ingredients ("=== Marinade ===", "=== Syrup ===").
 * Exiting at the first sub-heading silently truncated those recipes to nothing, so only a
 * heading at the SAME level or shallower ends the section. Sub-headings are kept as group
 * labels ending in a colon, which is how the rest of the catalog represents ingredient groups.
 */
function section(wt: string, re: RegExp): string[] {
  const lines = wt.split('\n');
  const out: string[] = [];
  let depth = 0; // 0 = not inside the section
  for (const raw of lines) {
    const h = raw.match(/^\s*(={2,})\s*(.+?)\s*={2,}\s*$/);
    if (h) {
      const level = h[1].length;
      const name = unwiki(h[2]).replace(/:$/, '').trim();
      if (depth && level <= depth) { depth = 0; continue; }      // section ended
      if (depth && level > depth) { if (name) out.push(`${name}:`); continue; } // group label
      if (re.test(name)) depth = level;                          // section started
      continue;
    }
    if (!depth) continue;
    const m = raw.match(/^\s*[*#]\s*(.+)$/);
    if (m) { const t = unwiki(m[1]); if (t) out.push(t); }
  }
  return out;
}

function summaryField(wt: string, field: string): string | null {
  const m = wt.match(new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n|}]+)`, 'i'));
  return m ? unwiki(m[1]).trim() || null : null;
}

function minutesFrom(s: string): number | null {
  const h = /(\d+)\s*(?:hours?|hrs?)/i.exec(s); const mi = /(\d+)\s*(?:minutes?|mins?)/i.exec(s);
  const n = (h ? +h[1] * 60 : 0) + (mi ? +mi[1] : 0);
  return n > 0 && n < 24 * 60 ? n : null;
}

export interface WikiExtra { license: { name: string; url: string }; imageCredit: string; imageLicense: { name: string; url: string } }
export type WbResult = { ok: true; recipe: StagedRecipe & WikiExtra } | { ok: false; url: string; reason: string };

export async function importWikibooks(title: string, opts: { theme: string }): Promise<WbResult> {
  const pageUrl = `https://en.wikibooks.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  let wt: string;
  try {
    const d = await api('en.wikibooks.org', { action: 'parse', page: title, prop: 'wikitext' });
    wt = d?.parse?.wikitext?.['*'];
    if (!wt) return { ok: false, url: pageUrl, reason: 'no-wikitext' };
  } catch (e: any) { return { ok: false, url: pageUrl, reason: `fetch:${e.code || e.message}` }; }

  const name = cleanText(title.replace(/^Cookbook:/, '').replace(/\s*\([^)]*\)\s*$/, '').trim());
  const slug = slugify(name);
  if (!slug) return { ok: false, url: pageUrl, reason: 'no-slug' };

  const ingredients = section(wt, /^ingredients?$/i).map((i) => cleanIngredientLine(i)).filter(Boolean);
  if (ingredients.length < 3) return { ok: false, url: pageUrl, reason: `too-few-ingredients:${ingredients.length}` };
  const instructions = section(wt, /^(procedure|directions?|method|preparation|steps?)$/i).map((s) => stripStepNumbering(s)).filter((s) => s.length > 4);
  if (instructions.length < 2) return { ok: false, url: pageUrl, reason: 'too-few-steps' };

  // --- photograph: resolve its own licence on Commons ---
  const file = (wt.match(/\[\[(?:File|Image):([^\]|]+)/i) || [])[1]?.trim();
  if (!file) return { ok: false, url: pageUrl, reason: 'no-image' };
  let info: any;
  try {
    const c = await api('commons.wikimedia.org', { action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'extmetadata|url', iiurlwidth: '1400' });
    info = Object.values(c.query?.pages || {})[0];
  } catch { return { ok: false, url: pageUrl, reason: 'commons-lookup-failed' }; }
  const ii = info?.imageinfo?.[0];
  if (!ii) return { ok: false, url: pageUrl, reason: 'image-not-on-commons' };
  const em = ii.extmetadata || {};
  const licName = String(em.LicenseShortName?.value || '').trim();
  const licUrl = String(em.LicenseUrl?.value || '').trim();
  if (!licName || BAD_LICENCE.test(licName) || !OK_LICENCE.test(licName)) return { ok: false, url: pageUrl, reason: `image-licence:${licName || 'unknown'}` };
  const artist = cleanText(String(em.Artist?.value || '').replace(/<[^>]+>/g, ' ')).slice(0, 80) || 'Wikimedia Commons contributor';

  const src = ii.thumburl || ii.url;
  let image: string | null = null;
  try {
    const res = await fetch(src, { redirect: 'follow', signal: AbortSignal.timeout(45_000) });
    if (!res.ok || !/^image\//i.test(res.headers.get('content-type') || '')) return { ok: false, url: pageUrl, reason: 'image-fetch-failed' };
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if (!meta.width || meta.width < 400) return { ok: false, url: pageUrl, reason: 'image-too-small' };
    fs.mkdirSync(IMG_DIR, { recursive: true });
    for (const w of IMG_WIDTHS) {
      await sharp(buf).resize({ width: w, height: Math.round((w * 3) / 4), fit: 'cover', position: 'attention' })
        .webp({ quality: 76 }).toFile(path.join(IMG_DIR, `${slug}-${w}.webp`));
    }
    image = `/recipe-images/${slug}.webp`;
  } catch { return { ok: false, url: pageUrl, reason: 'image-processing-failed' }; }
  await sleep(250);

  const timeStr = summaryField(wt, 'time');
  const total = timeStr ? minutesFrom(timeStr) : null;
  const servings = summaryField(wt, 'servings');

  return {
    ok: true,
    recipe: {
      id: slug, slug, title: name, image,
      prepTime: null, cookTime: null, totalTime: formatMinutes(total),
      servings: servings && /\d/.test(servings) ? `${servings.match(/\d+(\s*-\s*\d+)?/)![0]} servings` : null,
      ingredients, instructions,
      tags: ['indian', 'cc-by-sa'],
      source: { name: 'Wikibooks Cookbook', url: pageUrl },
      theme: opts.theme,
      difficulty: ingredients.length <= 8 && instructions.length <= 6 ? 'Easy' : 'Medium',
      addedDate: new Date().toISOString(),
      license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      imageCredit: artist,
      imageLicense: { name: licName, url: licUrl },
    },
  };
}
