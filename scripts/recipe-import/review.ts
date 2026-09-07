/**
 * Adversarial review. Every staged recipe is guilty until proven publishable.
 *
 * The job here is to FAIL recipes, not to pass them: a curated catalog is only as good as the
 * worst thing in it, and an import pipeline is exactly the kind of thing that quietly admits
 * truncated ingredient lines, 404 photos, duplicate dishes and impossible cook times at scale.
 * Every check below exists because it can actually happen to machine-extracted data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { durationToMinutes } from '../../src/lib/recipe/units';
import type { StagedRecipe } from './extract';

const IMG_WIDTHS = [360, 520, 700, 1000];

export interface Finding { slug: string; check: string; detail: string }

/** Text that means the extractor grabbed page furniture instead of a recipe. */
const BOILERPLATE = /(get the full recipe|click here to|read more at|subscribe|sign up|advertisement|cookie (policy|consent|settings)|privacy policy|print recipe|jump to recipe)/i;
/**
 * An ingredient line that is only a quantity — the food name was lost in extraction.
 * "cloves" is deliberately NOT in this list: whole cloves are a spice and a complete
 * ingredient on their own ("8 cloves"), and garlic lines always name the garlic.
 */
const QUANTITY_ONLY = /^[\d\s¼½¾⅓⅔⅛\/.,-]*(cups?|tbsp|tablespoons?|tsp|teaspoons?|g|kg|ml|l|oz|ounces?|pounds?|lbs?|large|medium|small|cans?|pinch|units?)?\.?$/i;

export function reviewOne(r: StagedRecipe, seen: Map<string, string>, existing: Set<string>, existingTitles: Set<string>): Finding[] {
  const f: Finding[] = [];
  const add = (check: string, detail: string) => f.push({ slug: r.slug, check, detail });

  // --- identity & duplication ---
  if (!/^[a-z0-9-]+$/.test(r.slug)) add('slug', `invalid slug "${r.slug}"`);
  if (existing.has(r.slug)) add('duplicate', 'slug already in catalog');
  if (existingTitles.has(r.title.toLowerCase().trim())) add('duplicate', `title already in catalog: "${r.title}"`);
  if (seen.has(r.slug)) add('duplicate', `slug collides with ${seen.get(r.slug)} in this batch`);
  if (r.title.length < 3 || r.title.length > 90) add('title', `implausible length (${r.title.length})`);
  if (/\|\s*(NSW|Nutrition|USDA)/i.test(r.title)) add('title', 'site name leaked into title');

  // --- content ---
  if (r.ingredients.length < 3) add('ingredients', `only ${r.ingredients.length}`);
  if (r.instructions.length < 2) add('instructions', `only ${r.instructions.length}`);
  if (r.ingredients.length > 40) add('ingredients', `implausible count ${r.ingredients.length}`);
  for (const i of r.ingredients) {
    if (QUANTITY_ONLY.test(i)) add('ingredients', `quantity with no food: "${i}"`);
    if (i.length > 220) add('ingredients', `line too long: "${i.slice(0, 50)}…"`);
    if (BOILERPLATE.test(i)) add('ingredients', `boilerplate: "${i.slice(0, 50)}"`);
  }
  for (const s of r.instructions) {
    if (BOILERPLATE.test(s)) add('instructions', `boilerplate: "${s.slice(0, 60)}"`);
    if (s.length < 4) add('instructions', `step too short: "${s}"`);
  }
  // Grouped recipes legitimately repeat an ingredient across groups ("Salt to taste" in both
  // the filling and the batter), so only flag repeats in an ungrouped list.
  const grouped = r.ingredients.some((i) => /:$/.test(i.trim()));
  if (!grouped && new Set(r.ingredients).size !== r.ingredients.length) add('ingredients', 'duplicate lines');

  // --- times: present values must be internally consistent ---
  const p = durationToMinutes(r.prepTime), c = durationToMinutes(r.cookTime), t = durationToMinutes(r.totalTime);
  if (t != null && (t <= 0 || t > 24 * 60)) add('time', `implausible total "${r.totalTime}"`);
  if (t != null && p != null && c != null && t < p + c - 1) add('time', `total ${t} < prep+cook ${p + c}`);
  if (r.totalTime && t == null) add('time', `unparseable total "${r.totalTime}"`);

  // --- photo: files must exist at every width and not be empty ---
  for (const w of IMG_WIDTHS) {
    const fp = path.join('public', 'recipe-images', `${r.slug}-${w}.webp`);
    if (!fs.existsSync(fp)) add('image', `missing ${w}w variant`);
    else if (fs.statSync(fp).size < 2000) add('image', `${w}w variant suspiciously small`);
  }
  if (!r.image?.startsWith('/recipe-images/')) add('image', `not self-hosted: "${r.image}"`);

  // --- provenance: every recipe must carry a source we can stand behind ---
  if (!r.source?.name || !r.source?.url) add('provenance', 'missing source name/url');
  if (r.source?.url && !/^https:\/\//.test(r.source.url)) add('provenance', 'source url not https');

  seen.set(r.slug, r.title);
  return f;
}

export function review(batch: StagedRecipe[], catalogPath = 'recipe-data/all-recipes.json') {
  const cat = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const existing = new Set<string>(cat.recipes.map((r: any) => r.slug));
  const existingTitles = new Set<string>(cat.recipes.map((r: any) => String(r.title).toLowerCase().trim()));
  const seen = new Map<string, string>();
  const findings: Finding[] = [];
  const clean: StagedRecipe[] = [];
  for (const r of batch) {
    const f = reviewOne(r, seen, existing, existingTitles);
    if (f.length) findings.push(...f); else clean.push(r);
  }
  return { clean, findings };
}

// CLI: only when invoked directly with a staging file (not when imported by merge.ts).
if (process.argv[2]?.endsWith('.json')) {
  const batch = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const { clean, findings } = review(batch);
  console.log(`reviewed ${batch.length}: clean=${clean.length} rejected=${batch.length - clean.length}`);
  const byCheck: Record<string, number> = {};
  for (const f of findings) byCheck[f.check] = (byCheck[f.check] || 0) + 1;
  console.log('findings by check:', JSON.stringify(byCheck, null, 1));
  for (const f of findings.slice(0, 25)) console.log(`  ${f.slug.slice(0, 34).padEnd(34)} ${f.check.padEnd(12)} ${f.detail.slice(0, 70)}`);
}
