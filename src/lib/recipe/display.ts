/**
 * Small display helpers shared by the recipe views. Pure; safe on server and client.
 * They tolerate BOTH the new Recipe model and legacy shapes (curated JSON, old cached/shared/
 * favorited objects) so nothing on disk needs migrating.
 */
import type { Recipe, RecipeSection } from './types';
import { durationToMinutes, formatMinutes, normalizeYield } from './units';
import { hostnameOf } from './href';

export interface AnyRecipe extends Partial<Recipe> {
  title: string;
  ingredients: string[];
  instructions: string[];
  /** legacy curated fields */
  slug?: string;
  tags?: string[];
  source?: any;
  theme?: string;
}

/** "4 servings" — handles legacy "4", "4 serving(s)", "Serves 4". */
export function displayServings(recipe: AnyRecipe): string | null {
  const s = recipe.servings;
  if (!s) return null;
  return normalizeYield(s).text;
}

/** Numeric baseline for scaling; null when we genuinely don't know. */
export function servingsCount(recipe: AnyRecipe): number | null {
  if (typeof recipe.yieldCount === 'number' && recipe.yieldCount > 0) return recipe.yieldCount;
  if (!recipe.servings) return null;
  const c = normalizeYield(recipe.servings).count;
  return c && c > 0 ? c : null;
}

export interface TimeParts {
  prep: string | null;
  cook: string | null;
  total: string | null;
}

/** Human-formatted times; re-normalizes legacy "150 min" / raw ISO strings. */
export function displayTimes(recipe: AnyRecipe): TimeParts {
  const prepM = recipe.prepMinutes ?? durationToMinutes(recipe.prepTime);
  const cookM = recipe.cookMinutes ?? durationToMinutes(recipe.cookTime);
  let totalM = recipe.totalMinutes ?? durationToMinutes(recipe.totalTime);
  if (totalM == null && (prepM || cookM)) totalM = (prepM || 0) + (cookM || 0);
  if (totalM != null && prepM != null && cookM != null && totalM < prepM + cookM) totalM = prepM + cookM;
  return { prep: formatMinutes(prepM), cook: formatMinutes(cookM), total: formatMinutes(totalM) };
}

/** One tabular meta line: "Prep 15 min · Cook 45 min · 4 servings" — only what's known. */
export function metaLine(recipe: AnyRecipe): string[] {
  const t = displayTimes(recipe);
  const parts: string[] = [];
  if (t.prep) parts.push(`Prep ${t.prep}`);
  if (t.cook) parts.push(`Cook ${t.cook}`);
  if (!t.prep && !t.cook && t.total) parts.push(`${t.total}`);
  else if (t.total && (t.prep || t.cook) && t.prep && t.cook) parts.push(`Total ${t.total}`);
  const s = displayServings(recipe);
  if (s) parts.push(s);
  return parts;
}

/** Known publishers → proper display names; anything else keeps its hostname. */
const SITE_NAMES: Record<string, string> = {
  'recipetineats.com': 'RecipeTin Eats',
  'budgetbytes.com': 'Budget Bytes',
  'cookieandkate.com': 'Cookie and Kate',
  'allrecipes.com': 'Allrecipes',
  'simplyrecipes.com': 'Simply Recipes',
  'bbcgoodfood.com': 'BBC Good Food',
  'sallysbakingaddiction.com': "Sally's Baking Addiction",
  'pinchofyum.com': 'Pinch of Yum',
  'seriouseats.com': 'Serious Eats',
  'foodnetwork.com': 'Food Network',
  'bonappetit.com': 'Bon Appétit',
  'epicurious.com': 'Epicurious',
  'nytimes.com': 'NYT Cooking',
  'cooking.nytimes.com': 'NYT Cooking',
  'food52.com': 'Food52',
  'thekitchn.com': 'The Kitchn',
  'smittenkitchen.com': 'Smitten Kitchen',
  'minimalistbaker.com': 'Minimalist Baker',
  'loveandlemons.com': 'Love and Lemons',
  'halfbakedharvest.com': 'Half Baked Harvest',
  'kingarthurbaking.com': 'King Arthur Baking',
  'delish.com': 'Delish',
  'tasteofhome.com': 'Taste of Home',
  'food.com': 'Food.com',
  'youtube.com': 'YouTube',
};

export function prettySiteName(hostOrName: string | null | undefined): string | null {
  if (!hostOrName) return null;
  const h = hostOrName.toLowerCase().replace(/^www\./, '');
  if (SITE_NAMES[h]) return SITE_NAMES[h];
  // "Recipetineats" (legacy curated) → look up by hostname-ish
  const guess = Object.keys(SITE_NAMES).find((k) => k.split('.')[0] === h);
  if (guess) return SITE_NAMES[guess];
  return hostOrName;
}

/** Where the recipe came from, for the trust line. */
export function sourceInfo(recipe: AnyRecipe, sourceUrl?: string | null): { name: string | null; url: string | null; author: string | null } {
  // Curated shape: source: { name, url }
  const legacy = recipe.source && typeof recipe.source === 'object' ? recipe.source : null;
  const url = sourceUrl || legacy?.url || recipe.sourceUrl || recipe.canonicalUrl || null;
  const host = hostnameOf(url);
  const name = recipe.siteName || (host && SITE_NAMES[host]) || prettySiteName(legacy?.name) || host || null;
  const author = recipe.author && recipe.author !== name ? recipe.author : null;
  return { name, url, author };
}

/** Grouped ingredients: uses ingredientGroups when present, else a single unnamed group. */
export function ingredientGroups(recipe: AnyRecipe): RecipeSection[] {
  const g = recipe.ingredientGroups;
  if (Array.isArray(g) && g.length && g.flatMap((x) => x.items).length === recipe.ingredients.length) return g;
  return [{ name: null, items: recipe.ingredients }];
}

export function instructionGroups(recipe: AnyRecipe): RecipeSection[] {
  const g = recipe.instructionGroups;
  if (Array.isArray(g) && g.length && g.flatMap((x) => x.items).length === recipe.instructions.length) return g;
  return [{ name: null, items: recipe.instructions }];
}

/** Text for "Copy ingredients". */
export function ingredientsAsText(recipe: AnyRecipe, lines?: string[]): string {
  const groups = ingredientGroups(recipe);
  const src = lines ?? recipe.ingredients;
  let i = 0;
  const out: string[] = [];
  for (const g of groups) {
    if (g.name) out.push(`${g.name}:`);
    for (const _ of g.items) out.push(`- ${src[i++] ?? ''}`);
    if (g.name) out.push('');
  }
  return out.join('\n').trim();
}

/** Full recipe as plain text (for Copy / share fallback). */
export function recipeAsText(recipe: AnyRecipe, sourceUrl?: string | null): string {
  const meta = metaLine(recipe).join(' · ');
  const src = sourceInfo(recipe, sourceUrl);
  const parts = [recipe.title, meta, src.url ? `Source: ${src.url}` : '', '', 'Ingredients', ingredientsAsText(recipe), '', 'Instructions'];
  let n = 1;
  for (const g of instructionGroups(recipe)) {
    if (g.name) parts.push(`${g.name}:`);
    for (const step of g.items) parts.push(`${n++}. ${step}`);
  }
  return parts.filter((p, i, a) => !(p === '' && a[i - 1] === '')).join('\n').trim();
}
