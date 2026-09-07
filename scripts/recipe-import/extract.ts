/**
 * Candidate URL -> staged catalog record, using the app's own extraction pipeline.
 *
 * Structured data only (JSON-LD / microdata): if a publisher didn't publish machine-readable
 * recipe data we skip the page rather than guess at it, so every imported quantity and step
 * is the author's own. No AI is used to invent or paraphrase anything.
 */
import { safeFetch } from '../../src/lib/safeFetch';
import { extractRecipeFromHtml } from '../../src/lib/recipe/extract';
import { cleanIngredientLine, cleanText, stripStepNumbering } from '../../src/lib/recipe/normalize';

export interface StagedRecipe {
  id: string; slug: string; title: string; image: string;
  prepTime: string | null; cookTime: string | null; totalTime: string | null;
  servings: string | null;
  ingredients: string[]; instructions: string[];
  tags: string[];
  source: { name: string; url: string };
  theme: string;
  difficulty: 'Easy' | 'Medium';
  addedDate: string;
}

export function slugify(title: string): string {
  return cleanText(title).toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');
}

const TAG_RULES: [RegExp, string][] = [
  [/\b(vegan)\b/i, 'vegan'], [/\b(vegetarian|meat.?free)\b/i, 'vegetarian'],
  [/\b(chicken|turkey|poultry)\b/i, 'poultry'], [/\bbeef|steak\b/i, 'beef'], [/\bpork|bacon\b/i, 'pork'],
  [/\b(fish|salmon|tuna|shrimp|prawn|seafood)\b/i, 'seafood'],
  [/\b(pasta|noodle|spaghetti)\b/i, 'pasta'], [/\b(soup|stew|chowder)\b/i, 'soup'],
  [/\b(salad)\b/i, 'salad'], [/\b(curry)\b/i, 'curry'], [/\b(bake|baking|bread|cake|cookie)\b/i, 'baking'],
  [/\b(dessert|sweet|pudding)\b/i, 'dessert'], [/\b(breakfast|brunch)\b/i, 'breakfast'],
  [/\b(grill|bbq|barbecue)\b/i, 'grilling'], [/\b(one.?pot|one.?pan|skillet)\b/i, 'one-pot'],
  [/\b(quick|easy|30.?minute|15.?minute)\b/i, 'quick'], [/\b(healthy|light)\b/i, 'healthy'],
  [/\b(indian)\b/i, 'indian'], [/\b(italian)\b/i, 'italian'], [/\b(mexican)\b/i, 'mexican'],
  [/\b(asian|chinese|thai|japanese|korean|vietnamese)\b/i, 'asian'],
  [/\b(mediterranean|greek)\b/i, 'mediterranean'], [/\b(comfort)\b/i, 'comfort'],
  [/\b(appetizer|starter|dip|snack)\b/i, 'appetizer'],
];

function deriveTags(r: { title: string; keywords?: string[]; category?: string | null; cuisine?: string | null }, extra: string[]): string[] {
  const hay = [r.title, ...(r.keywords || []), r.category || '', r.cuisine || ''].join(' ');
  const tags = new Set<string>(extra);
  for (const [re, tag] of TAG_RULES) if (re.test(hay)) tags.add(tag);
  return [...tags].slice(0, 6);
}

export interface ExtractOpts { theme: string; extraTags?: string[] }

export type ExtractResult =
  | { ok: true; recipe: StagedRecipe; method: string }
  | { ok: false; url: string; reason: string };

export async function extractOne(url: string, opts: ExtractOpts): Promise<ExtractResult> {
  let body: string, finalUrl: string;
  try {
    const res = await safeFetch(url, { maxBytes: 4_000_000 });
    body = res.body; finalUrl = res.url;
  } catch (e: any) {
    return { ok: false, url, reason: `fetch:${e.code || e.message}${e.status ? ':' + e.status : ''}` };
  }
  const out = extractRecipeFromHtml(body, finalUrl);
  const r = out.recipe;
  if (!r) return { ok: false, url, reason: 'no-recipe-data' };
  // Structured data only — heuristic DOM scrapes are too lossy to put in a curated catalog.
  if (out.method !== 'jsonld' && out.method !== 'microdata') return { ok: false, url, reason: `method:${out.method}` };
  if (!r.image) return { ok: false, url, reason: 'no-image' };

  const ingredients = r.ingredients.map((i) => cleanIngredientLine(i)).filter(Boolean);
  const instructions = r.instructions.map((s) => stripStepNumbering(cleanText(s))).filter(Boolean);
  const title = cleanText(r.title);
  const host = new URL(finalUrl).hostname.replace(/^www\./, '');
  const totalMin = r.totalMinutes ?? null;

  return {
    ok: true,
    method: out.method,
    recipe: {
      id: slugify(title), slug: slugify(title), title,
      image: r.image,
      prepTime: r.prepTime, cookTime: r.cookTime, totalTime: r.totalTime,
      servings: r.servings,
      ingredients, instructions,
      tags: deriveTags({ title, keywords: r.keywords, category: r.category, cuisine: r.cuisine }, opts.extraTags || []),
      source: { name: host, url: r.canonicalUrl || finalUrl },
      theme: opts.theme,
      // Mirrors the catalog's existing split: short + few steps reads Easy, everything else Medium.
      difficulty: (totalMin != null && totalMin <= 30 && instructions.length <= 6) || ingredients.length <= 6 ? 'Easy' : 'Medium',
      addedDate: new Date().toISOString(),
    },
  };
}
