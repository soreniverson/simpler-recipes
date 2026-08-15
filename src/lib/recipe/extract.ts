/**
 * Page HTML → Recipe. The extraction waterfall:
 *
 *   1. JSON-LD Recipe (best node on the page)
 *   2. schema.org microdata
 *   3. structural heuristics (Ingredients heading + list, Instructions heading + steps)
 *
 * The AI fallback (Claude) lives in the API route, not here — this module is pure and
 * fully unit-testable against saved fixtures.
 */
import type { RecipeSection, Recipe, ExtractionOutcome } from './types';
import { extractRecipeFromJsonLd } from './jsonld';
import { extractIngredientSectionsFromDom, INGREDIENT_SECTION_HINT } from './html';
import { parseHtml, extractPageMeta, extractRecipeFromMicrodata, extractRecipeFromStructure } from './html';

export interface ExtractOptions {
  /** Try the DOM heuristics fallback. Default true. */
  allowHeuristics?: boolean;
}

export function extractRecipeFromHtml(html: string, pageUrl?: string, opts: ExtractOptions = {}): ExtractionOutcome {
  try {
    return extractRecipeFromHtmlUnsafe(html, pageUrl, opts);
  } catch (err) {
    // Pathological markup (300k nested divs → stack overflow) must read as "no recipe", not 500.
    console.warn('[extract] parser threw:', err instanceof Error ? err.message : err);
    return { recipe: null, method: 'unknown', candidates: 0 };
  }
}

function extractRecipeFromHtmlUnsafe(html: string, pageUrl?: string, opts: ExtractOptions = {}): ExtractionOutcome {
  const allowHeuristics = opts.allowHeuristics ?? true;

  // 1. JSON-LD
  const ld = extractRecipeFromJsonLd(html, pageUrl);
  let recipe: Recipe | null = ld.recipe;
  let method: ExtractionOutcome['method'] = 'jsonld';

  // Fill gaps / fallbacks need the DOM. Only parse when needed (JSON-LD covers ~90%).
  const incomplete = !!recipe && (!recipe.instructions.length || !recipe.ingredients.length);
  const needsDom = !recipe || incomplete || !recipe.image || !recipe.siteName;
  if (needsDom) {
    let doc: ReturnType<typeof parseHtml> | null = null;
    try {
      doc = parseHtml(html);
    } catch {
      doc = null;
    }
    if (doc) {
      const meta = extractPageMeta(doc, pageUrl);
      if (!recipe) {
        recipe = extractRecipeFromMicrodata(doc, pageUrl);
        method = 'microdata';
      }
      if (!recipe && allowHeuristics) {
        recipe = extractRecipeFromStructure(doc, pageUrl, meta);
        method = 'html';
      }
      // Structured data present but half-empty (e.g. `recipeInstructions: []`): borrow the missing
      // half from the page's own markup when it's clearly there.
      if (recipe && incomplete && allowHeuristics) {
        const fromDom = extractRecipeFromMicrodata(doc, pageUrl) ?? extractRecipeFromStructure(doc, pageUrl, meta, { allowPartial: true });
        if (fromDom) {
          if (!recipe.instructions.length && fromDom.instructions.length) {
            recipe.instructions = fromDom.instructions;
            if (fromDom.instructionGroups) recipe.instructionGroups = fromDom.instructionGroups;
            else delete recipe.instructionGroups;
          }
          if (!recipe.ingredients.length && fromDom.ingredients.length) {
            recipe.ingredients = fromDom.ingredients;
            if (fromDom.ingredientGroups) recipe.ingredientGroups = fromDom.ingredientGroups;
            else delete recipe.ingredientGroups;
          }
        }
      }
      if (recipe) {
        if (!recipe.image && meta.ogImage) recipe.image = meta.ogImage;
        if (!recipe.siteName && meta.siteName) recipe.siteName = meta.siteName;
        if (!recipe.canonicalUrl && meta.canonical && pageUrl && !sameUrl(meta.canonical, pageUrl)) recipe.canonicalUrl = meta.canonical;
        if (!recipe.description && meta.description && method !== 'jsonld') recipe.description = meta.description;
      }
    }
  }

  if (!recipe) return { recipe: null, method: 'unknown', candidates: ld.candidates };

  // Flat ingredient list from structured data, but the page's recipe card has sections
  // ("Chicken tikka" / "Sauce") — regroup when the section counts add up exactly.
  if (allowHeuristics && recipe.ingredients.length >= 4 && (!recipe.ingredientGroups || recipe.ingredientGroups.length < 2) && INGREDIENT_SECTION_HINT.test(html)) {
    try {
      const doc = parseHtml(html);
      const sections = extractIngredientSectionsFromDom(doc);
      const total = sections.reduce((n, s) => n + s.count, 0);
      if (sections.length >= 2 && total === recipe.ingredients.length) {
        let i = 0;
        recipe.ingredientGroups = sections.map((s) => {
          const items = recipe!.ingredients.slice(i, i + s.count);
          i += s.count;
          return { name: s.name, items };
        });
      }
    } catch {
      /* keep flat */
    }
  }

  recipe.extractedVia = recipe.extractedVia ?? method;
  if (!recipe.siteName && pageUrl) recipe.siteName = siteNameFromUrl(pageUrl);
  return { recipe: finalize(recipe), method: recipe.extractedVia!, candidates: ld.candidates };
}

function sameUrl(a: string, b: string): boolean {
  try {
    const x = new URL(a), y = new URL(b);
    return x.hostname.replace(/^www\./, '') === y.hostname.replace(/^www\./, '') && x.pathname.replace(/\/+$/, '') === y.pathname.replace(/\/+$/, '');
  } catch {
    return a === b;
  }
}

/** "www.recipetineats.com" → "recipetineats.com" (display fallback when no og:site_name). */
export function siteNameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Last-mile invariants so downstream code can trust the shape. */
export function finalize(r: Recipe): Recipe {
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  r.title = clip(r.title || 'Untitled Recipe', 200);
  r.ingredients = (r.ingredients || []).filter(Boolean).slice(0, 200).map((s) => clip(s, 500));
  r.instructions = (r.instructions || []).filter(Boolean).slice(0, 200).map((s) => clip(s, 2500));
  const clipGroups = (gs: RecipeSection[] | undefined, n: number) => gs?.map((g) => ({ name: g.name ? clip(g.name, 120) : null, items: g.items.map((s) => clip(s, n)) }));
  r.ingredientGroups = clipGroups(r.ingredientGroups, 500);
  r.instructionGroups = clipGroups(r.instructionGroups, 2500);
  if (r.description) r.description = clip(r.description, 400);
  if (r.author) r.author = clip(r.author, 120);
  for (const k of ['prepMinutes', 'cookMinutes', 'totalMinutes'] as const) {
    const v = r[k];
    if (v != null && (!Number.isFinite(v) || v <= 0 || v > 100_000)) r[k] = null;
  }
  if (r.yieldCount != null && r.yieldCount > 5000) r.yieldCount = null;
  if (r.ingredientGroups) {
    r.ingredientGroups = r.ingredientGroups.filter((g) => g.items.length);
    if (r.ingredientGroups.length <= 1 && !r.ingredientGroups[0]?.name) delete r.ingredientGroups;
  }
  if (r.instructionGroups) {
    r.instructionGroups = r.instructionGroups.filter((g) => g.items.length);
    if (r.instructionGroups.length <= 1 && !r.instructionGroups[0]?.name) delete r.instructionGroups;
  }
  // Never let a scaling baseline be invented.
  if (r.yieldCount != null && (!Number.isFinite(r.yieldCount) || r.yieldCount <= 0)) r.yieldCount = null;
  return r;
}
