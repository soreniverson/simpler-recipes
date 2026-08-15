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
import type { Recipe, ExtractionOutcome } from './types';
import { extractRecipeFromJsonLd } from './jsonld';
import { parseHtml, extractPageMeta, extractRecipeFromMicrodata, extractRecipeFromStructure } from './html';

export interface ExtractOptions {
  /** Try the DOM heuristics fallback. Default true. */
  allowHeuristics?: boolean;
}

export function extractRecipeFromHtml(html: string, pageUrl?: string, opts: ExtractOptions = {}): ExtractionOutcome {
  const allowHeuristics = opts.allowHeuristics ?? true;

  // 1. JSON-LD
  const ld = extractRecipeFromJsonLd(html, pageUrl);
  let recipe: Recipe | null = ld.recipe;
  let method: ExtractionOutcome['method'] = 'jsonld';

  // Fill gaps / fallbacks need the DOM. Only parse when needed (JSON-LD covers ~90%).
  const needsDom = !recipe || !recipe.image || !recipe.siteName;
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
      if (recipe) {
        if (!recipe.image && meta.ogImage) recipe.image = meta.ogImage;
        if (!recipe.siteName && meta.siteName) recipe.siteName = meta.siteName;
        if (!recipe.canonicalUrl && meta.canonical && pageUrl && !sameUrl(meta.canonical, pageUrl)) recipe.canonicalUrl = meta.canonical;
        if (!recipe.description && meta.description && method !== 'jsonld') recipe.description = meta.description;
      }
    }
  }

  if (!recipe) return { recipe: null, method: 'unknown', candidates: ld.candidates };
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
  r.title = (r.title || 'Untitled Recipe').slice(0, 200);
  r.ingredients = (r.ingredients || []).filter(Boolean).slice(0, 200);
  r.instructions = (r.instructions || []).filter(Boolean).slice(0, 200);
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
