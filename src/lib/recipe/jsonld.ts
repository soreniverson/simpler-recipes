/**
 * JSON-LD discovery + Recipe node → Recipe model.
 *
 * Handles the real-world mess: arrays at the root, @graph, nested mainEntity, multiple Recipe
 * nodes on one page (pick the best), `@type` as string or array with any casing, HowToSection,
 * string instructions, ImageObject/array images, yield arrays, HTML in text, entities.
 */
import type { Recipe, RecipeSection } from './types';
import {
  cleanText,
  cleanTitle,
  decodeEntities,
  durationToMinutes,
  formatMinutes,
  normalizeYield,
  normalizeImage,
  groupIngredients,
  normalizeInstructions,
  normalizeAuthor,
  normalizeKeywords,
} from './normalize';

/** Extract and parse every <script type="application/ld+json"> block. Tolerant of junk. */
export function extractJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    const parsed = parseJsonLoose(raw);
    if (parsed !== undefined) out.push(parsed);
  }
  return out;
}

/** JSON.parse with recovery for the common ways sites break their JSON-LD. */
export function parseJsonLoose(raw: string): unknown {
  let s = raw.trim();
  if (!s) return undefined;
  // Strip HTML comments / CDATA wrappers some CMSs emit.
  s = s.replace(/^\s*<!--/, '').replace(/-->\s*$/, '').replace(/^\s*\/\/\s*<!\[CDATA\[/, '').replace(/\/\/\s*\]\]>\s*$/, '').trim();
  try {
    return JSON.parse(s);
  } catch {
    /* fall through */
  }
  // Common breakages: literal newlines/tabs inside strings, trailing commas, unescaped control chars.
  const repaired = s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/(["'])?([\r\n\t]+)/g, (m0, q, ws) => (q ? q + ' ' : ' '))
    .replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(repaired);
  } catch {
    /* fall through */
  }
  // Some pages concatenate two JSON objects in one script. Try to split top-level objects.
  const objs = splitConcatenatedJson(s);
  if (objs.length > 1) return objs;
  return undefined;
}

function splitConcatenatedJson(s: string): unknown[] {
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          out.push(JSON.parse(s.slice(start, i + 1)));
        } catch {
          /* skip */
        }
        start = -1;
      }
    }
  }
  return out;
}

function typeList(node: any): string[] {
  const t = node?.['@type'];
  if (!t) return [];
  const arr = Array.isArray(t) ? t : [t];
  return arr.filter((x) => typeof x === 'string').map((x) => x.toLowerCase().replace(/^https?:\/\/schema\.org\//, '').replace(/^schema:/, ''));
}

export function isRecipeNode(node: unknown): boolean {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  return typeList(node).includes('recipe');
}

/**
 * Walk any JSON-LD structure and collect every Recipe node (deduped by identity).
 * Looks in arrays, @graph, mainEntity, mainEntityOfPage, hasPart, itemListElement, about, subjectOf.
 */
export function findRecipeNodes(root: unknown): any[] {
  const found: any[] = [];
  const seen = new Set<any>();
  const NESTED_KEYS = ['@graph', 'mainEntity', 'mainEntityOfPage', 'hasPart', 'itemListElement', 'about', 'subjectOf', 'item', 'isPartOf'];
  const walk = (node: unknown, depth: number) => {
    if (!node || depth > 8) return;
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, depth + 1));
      return;
    }
    if (typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (isRecipeNode(node)) found.push(node);
    for (const k of NESTED_KEYS) {
      const v = (node as any)[k];
      if (v && typeof v === 'object') walk(v, depth + 1);
    }
  };
  walk(root, 0);
  return found;
}

/**
 * Build a map of `@id` → node across all blocks so `{ "@id": "…#/schema/person/1" }`
 * references (Yoast, RankMath, WPRM) can be resolved to the actual Person/ImageObject/Organization.
 */
export function collectNodesById(blocks: unknown[]): Map<string, any> {
  const byId = new Map<string, any>();
  const seen = new Set<any>();
  const walk = (node: unknown, depth: number) => {
    if (!node || depth > 8 || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, depth + 1));
      return;
    }
    if (seen.has(node)) return;
    seen.add(node);
    const o = node as any;
    if (typeof o['@id'] === 'string' && Object.keys(o).length > 1 && !byId.has(o['@id'])) byId.set(o['@id'], o);
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(blocks, 0);
  return byId;
}

/** Replace `{ "@id": x }` (or arrays of them) with the referenced node when known. */
export function resolveRefs(value: unknown, byId: Map<string, any>, depth = 0): unknown {
  if (!value || depth > 3 || !byId.size) return value;
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, byId, depth + 1));
  if (typeof value === 'object') {
    const o = value as any;
    const keys = Object.keys(o);
    if (typeof o['@id'] === 'string' && keys.length <= 2 && byId.has(o['@id'])) {
      const target = byId.get(o['@id']);
      return target === value ? value : target;
    }
  }
  return value;
}

/**
 * Score a Recipe node so the "real" recipe wins over teaser/related recipes on the same page.
 */
export function scoreRecipeNode(node: any, pageUrl?: string): number {
  let score = 0;
  const ing = Array.isArray(node.recipeIngredient) ? node.recipeIngredient.length : typeof node.recipeIngredient === 'string' ? 1 : 0;
  const steps = normalizeInstructions(node.recipeInstructions).reduce((n, s) => n + s.items.length, 0);
  score += Math.min(ing, 30) * 2;
  score += Math.min(steps, 30) * 2;
  if (node.name) score += 3;
  if (node.image) score += 2;
  if (node.recipeYield) score += 1;
  if (node.prepTime || node.cookTime || node.totalTime) score += 1;
  if (pageUrl) {
    const candidates = [node.url, node['@id'], node.mainEntityOfPage?.['@id'], node.mainEntityOfPage?.url, node.mainEntityOfPage]
      .filter((x) => typeof x === 'string') as string[];
    const page = stripUrl(pageUrl);
    if (candidates.some((c) => stripUrl(c) === page)) score += 25;
  }
  return score;
}

function stripUrl(u: string): string {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

/** Pick the best Recipe node among all JSON-LD blocks on the page. */
export function selectRecipeNode(blocks: unknown[], pageUrl?: string): { node: any | null; candidates: number } {
  const nodes = blocks.flatMap((b) => findRecipeNodes(b));
  if (!nodes.length) return { node: null, candidates: 0 };
  let best = nodes[0];
  let bestScore = -1;
  for (const n of nodes) {
    const s = scoreRecipeNode(n, pageUrl);
    if (s > bestScore) {
      best = n;
      bestScore = s;
    }
  }
  return { node: best, candidates: nodes.length };
}

/** Coerce recipeIngredient in any shape into string[]. */
function ingredientLines(node: any): string[] {
  const raw = node.recipeIngredient ?? node.ingredients ?? node.ingredient;
  if (!raw) return [];
  if (typeof raw === 'string') {
    // Some sites join with newlines or <br>.
    return raw.split(/<br\s*\/?>|\r?\n/i).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw
      .flatMap((x) => {
        if (typeof x === 'string') return [x];
        if (x && typeof x === 'object') {
          const o = x as any;
          if (typeof o.name === 'string') return [o.name];
          if (typeof o.text === 'string') return [o.text];
          if (Array.isArray(o.itemListElement)) return ingredientLines({ recipeIngredient: o.itemListElement });
        }
        return [];
      })
      .filter(Boolean);
  }
  return [];
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v;
    if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0];
  }
  return null;
}

/** Convert a Recipe JSON-LD node into our Recipe model. Returns null if unusable. */
export function recipeFromJsonLd(node: any, pageUrl?: string, byId: Map<string, any> = new Map()): Recipe | null {
  if (!node || typeof node !== 'object') return null;
  const ref = (v: unknown) => resolveRefs(v, byId);

  const ingredientGroups = groupIngredients(ingredientLines(node));
  const instructionGroups = normalizeInstructions(node.recipeInstructions);
  const ingredients = ingredientGroups.flatMap((g) => g.items);
  const instructions = instructionGroups.flatMap((g) => g.items);
  if (!ingredients.length && !instructions.length) return null;

  const publisherNode0 = ref(node.publisher) as any;
  const siteName0 = publisherNode0 && typeof publisherNode0 === 'object' ? cleanText(publisherNode0.name) : null;
  const title = cleanTitle(node.name || node.headline, siteName0) || 'Untitled Recipe';
  const prepMinutes = durationToMinutes(node.prepTime);
  const cookMinutes = durationToMinutes(node.cookTime);
  let totalMinutes = durationToMinutes(node.totalTime);
  if (totalMinutes == null && (prepMinutes || cookMinutes)) totalMinutes = (prepMinutes || 0) + (cookMinutes || 0);
  // Guard nonsense: total shorter than sum of parts (some sites emit "PT0M" totals).
  if (totalMinutes != null && prepMinutes != null && cookMinutes != null && totalMinutes < prepMinutes + cookMinutes) {
    totalMinutes = prepMinutes + cookMinutes;
  }

  const rawYield = node.recipeYield ?? node.yield;
  const y = normalizeYield(typeof rawYield === 'string' ? decodeEntities(rawYield) : rawYield);
  const image = normalizeImage(ref(node.image ?? node.thumbnailUrl), pageUrl);
  const description = cleanText(node.description) || null;

  const url = firstString(node.url, node.mainEntityOfPage?.['@id'], node.mainEntityOfPage?.url, node['@id']);
  const publisherNode = ref(node.publisher) as any;
  const publisher = publisherNode && typeof publisherNode === 'object' ? cleanText(publisherNode.name) : null;
  const partOf = ref(node.isPartOf) as any;
  const siteName = publisher || (partOf && typeof partOf === 'object' ? cleanText(partOf.name) : null) || null;

  const recipe: Recipe = {
    title,
    description: description && description.length > 400 ? description.slice(0, 397).trimEnd() + '…' : description,
    ingredients,
    instructions,
    prepTime: formatMinutes(prepMinutes),
    cookTime: formatMinutes(cookMinutes),
    totalTime: formatMinutes(totalMinutes),
    prepMinutes,
    cookMinutes,
    totalMinutes,
    servings: y.text,
    yieldCount: y.count,
    image,
    author: normalizeAuthor(ref(node.author)),
    siteName: siteName || null,
    sourceUrl: pageUrl ?? null,
    canonicalUrl: url && pageUrl && stripUrl(url) !== stripUrl(pageUrl) && /^https?:\/\//.test(url) ? url : null,
    datePublished: typeof node.datePublished === 'string' ? node.datePublished.slice(0, 10) : null,
    keywords: normalizeKeywords(node.keywords, [node.recipeCategory, node.recipeCuisine, node.suitableForDiet]),
    category: firstString(node.recipeCategory) ? cleanText(firstString(node.recipeCategory)) : null,
    cuisine: firstString(node.recipeCuisine) ? cleanText(firstString(node.recipeCuisine)) : null,
    extractedVia: 'jsonld',
  };
  if (ingredientGroups.some((g) => g.name)) recipe.ingredientGroups = ingredientGroups as RecipeSection[];
  if (instructionGroups.some((g) => g.name)) recipe.instructionGroups = instructionGroups as RecipeSection[];
  return recipe;
}

/** Convenience: HTML → best Recipe (JSON-LD only). */
export function extractRecipeFromJsonLd(html: string, pageUrl?: string): { recipe: Recipe | null; candidates: number } {
  const blocks = extractJsonLdBlocks(html);
  const { node, candidates } = selectRecipeNode(blocks, pageUrl);
  if (!node) return { recipe: null, candidates };
  const byId = collectNodesById(blocks);
  const recipe = recipeFromJsonLd(node, pageUrl, byId);
  if (recipe) return { recipe, candidates };
  // Best node unusable (e.g. empty teaser). Try the others in score order.
  const nodes = blocks.flatMap((b) => findRecipeNodes(b)).filter((n) => n !== node);
  nodes.sort((a, b) => scoreRecipeNode(b, pageUrl) - scoreRecipeNode(a, pageUrl));
  for (const n of nodes) {
    const r = recipeFromJsonLd(n, pageUrl, byId);
    if (r) return { recipe: r, candidates };
  }
  return { recipe: null, candidates };
}

export { decodeEntities };
