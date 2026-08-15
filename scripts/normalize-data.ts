#!/usr/bin/env node --experimental-strip-types
/**
 * One-time (and re-runnable, idempotent) cleanup of the curated recipe data using the SAME
 * normalizers the live extractor uses, so stored recipes and freshly extracted ones look alike.
 *
 *   node --experimental-strip-types scripts/normalize-data.ts [--dry]
 *
 * Fixes: WPRM nested-paren artifacts, "(Note 1)" references, price annotations, NBSP/entities,
 * "150 min" → "2 hr 30 min", malformed totalTime ("10 min 20 min"), missing totalTime,
 * step numbering prefixes, duplicate collection entries, empty recipes, and rewrites
 * `all-recipes.json` collection recipe counts. Also removes the 7 recipes mis-tagged
 * "vegetarian" that contain meat/fish.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanIngredientLine, cleanText, durationToMinutes, formatMinutes, stripStepNumbering, cleanTitle } from '../src/lib/recipe/normalize.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'recipe-data');
const DRY = process.argv.includes('--dry');

const stats: Record<string, number> = {};
const bump = (k: string, n = 1) => (stats[k] = (stats[k] || 0) + n);

/** Strip source-site cross references that mean nothing here. */
function stripNotes(s: string): string {
  return s
    .replace(/\s*\(\s*(?:see\s+)?notes?\s*\d+(?:\s*(?:,|&|and)\s*\d+)*(?:\s*,\s*[^)]{0,40})?\s*\)/gi, '')
    .replace(/\s*\(\s*(?:see\s+)?(?:recipe\s+)?notes?\s*\)/gi, '')
    .replace(/\s*\(\s*(?:see\s+)?video\s*(?:helpful\s+here)?\s*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;.])/g, '$1')
    .trim();
}

function fixTime(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // Malformed "10 min 20 min" (prep+cook concatenated) — treat as two parts and sum
  const parts = s.match(/\d+\s*(?:hrs?|hours?|min|mins|minutes)/gi);
  if (parts && parts.length > 1 && !/hr.*min|hour.*min/i.test(s)) {
    const total = parts.reduce((acc, p) => acc + (durationToMinutes(p) || 0), 0);
    return formatMinutes(total);
  }
  return formatMinutes(durationToMinutes(s));
}

const MEATY = /\b(chicken|beef|steak|pork|bacon|ham|lamb|turkey|sausage|chorizo|prosciutto|pancetta|anchov\w*|tuna|salmon|shrimp|prawns?|fish|cod|crab|clams?|mussels?|oyster|scallops?|squid|gelatin)\b(?!\s+seasoning)(?!\s+or\s+veg)/i;

function normalizeRecipe(r: any): any {
  const before = JSON.stringify(r);
  const out = { ...r };
  out.title = cleanTitle(r.title) || r.title;
  if (out.title !== r.title) bump('title');
  out.ingredients = (r.ingredients || [])
    .map((i: string) => stripNotes(cleanIngredientLine(i)))
    .filter((i: string) => i && i.length > 0);
  if (JSON.stringify(out.ingredients) !== JSON.stringify(r.ingredients)) bump('ingredients');
  out.instructions = (r.instructions || [])
    .map((s: string) => stripNotes(stripStepNumbering(cleanText(s))))
    .filter((s: string) => s && s.length > 1);
  if (JSON.stringify(out.instructions) !== JSON.stringify(r.instructions)) bump('instructions');
  const prep = fixTime(r.prepTime);
  const cook = fixTime(r.cookTime);
  let total = fixTime(r.totalTime);
  const pm = durationToMinutes(prep);
  const cm = durationToMinutes(cook);
  const tm = durationToMinutes(total);
  if ((tm == null || (pm != null && cm != null && tm < pm + cm)) && (pm || cm)) total = formatMinutes((pm || 0) + (cm || 0));
  if (prep !== r.prepTime || cook !== r.cookTime || total !== r.totalTime) bump('times');
  out.prepTime = prep;
  out.cookTime = cook;
  out.totalTime = total;
  if (r.servings != null && String(r.servings).trim() === '') out.servings = null;
  // Mis-tagged vegetarian
  if (Array.isArray(out.tags) && out.tags.includes('vegetarian')) {
    const text = out.ingredients.join(' ') + ' ' + out.title;
    if (MEATY.test(text)) {
      out.tags = out.tags.filter((t: string) => t !== 'vegetarian' && t !== 'meatless' && t !== 'plant-based');
      bump('untagged-vegetarian');
    }
  }
  if (JSON.stringify(out) !== before) bump('recipes-changed');
  return out;
}

// ---- all-recipes.json ----
const allPath = path.join(DATA_DIR, 'all-recipes.json');
const all = JSON.parse(fs.readFileSync(allPath, 'utf8'));
const dropSlugs = new Set<string>();
all.recipes = all.recipes
  .map(normalizeRecipe)
  .filter((r: any) => {
    const ok = r.ingredients.length >= 1 && r.instructions.length >= 1;
    if (!ok) {
      dropSlugs.add(r.slug);
      bump('dropped-empty');
    }
    return ok;
  });
const known = new Set(all.recipes.map((r: any) => r.slug));

for (const c of all.collections) {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const s of c.recipes) {
    if (seen.has(s) || dropSlugs.has(s) || !known.has(s)) {
      bump('collection-entries-removed');
      continue;
    }
    seen.add(s);
    cleaned.push(s);
  }
  c.recipes = cleaned;
  c.recipeCount = cleaned.length;
}
all.metadata = { ...(all.metadata || {}), normalizedAt: new Date().toISOString() };

// ---- per-collection files ----
for (const c of all.collections) {
  const p = path.join(DATA_DIR, `${c.slug}.json`);
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const seen = new Set<string>();
  data.recipes = data.recipes
    .map(normalizeRecipe)
    .filter((r: any) => {
      if (seen.has(r.slug) || dropSlugs.has(r.slug)) return false;
      seen.add(r.slug);
      return r.ingredients.length >= 1 && r.instructions.length >= 1;
    });
  data.metadata = { ...(data.metadata || {}), recipeCount: data.recipes.length, lastUpdated: new Date().toISOString() };
  if (!DRY) fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}
if (!DRY) fs.writeFileSync(allPath, JSON.stringify(all, null, 2) + '\n');

console.log(DRY ? '[dry run]' : '[written]', stats);
