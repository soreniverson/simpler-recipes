/**
 * DOM-based fallbacks used when JSON-LD is missing or unusable:
 *   1. schema.org microdata (itemtype=…/Recipe with itemprop=recipeIngredient etc.)
 *   2. page metadata (og:title, og:image, og:site_name, <link rel=canonical>) to fill gaps
 *   3. structural heuristics: an "Ingredients" heading followed by a list, "Instructions"/
 *      "Directions"/"Method" heading followed by a list or paragraphs. Conservative — only
 *      returns a recipe when both an ingredient list and steps are found.
 */
import { parseDocument } from 'htmlparser2';
import { selectAll, selectOne } from 'css-select';
import { textContent, getAttributeValue, isTag, getChildren } from 'domutils';
import type { AnyNode, Element } from 'domhandler';
import type { Recipe, RecipeSection } from './types';
import {
  cleanText,
  durationToMinutes,
  formatMinutes,
  normalizeYield,
  normalizeImage,
  groupIngredients,
  normalizeInstructions,
  cleanIngredientLine,
  stripStepNumbering,
} from './normalize';

export interface PageMeta {
  title: string | null;
  ogTitle: string | null;
  ogImage: string | null;
  siteName: string | null;
  canonical: string | null;
  description: string | null;
}

export function parseHtml(html: string) {
  return parseDocument(html, { decodeEntities: true, lowerCaseAttributeNames: true });
}

function attr(el: Element | null, name: string): string | null {
  if (!el) return null;
  const v = getAttributeValue(el, name);
  return v == null ? null : v;
}

function text(el: AnyNode | null): string {
  return el ? cleanText(textContent(el)) : '';
}

export function extractPageMeta(doc: ReturnType<typeof parseHtml>, baseUrl?: string): PageMeta {
  const meta = (sel: string, key: string) => {
    const el = selectOne(sel, doc) as Element | null;
    return el ? attr(el, key) : null;
  };
  const ogImage = meta('meta[property="og:image"]', 'content') || meta('meta[property="og:image:url"]', 'content') || meta('meta[name="twitter:image"]', 'content');
  const canonicalRaw = meta('link[rel="canonical"]', 'href');
  let canonical: string | null = null;
  if (canonicalRaw) {
    try {
      canonical = new URL(canonicalRaw, baseUrl).toString();
    } catch {
      canonical = null;
    }
  }
  const titleEl = selectOne('title', doc) as Element | null;
  return {
    title: titleEl ? text(titleEl) || null : null,
    ogTitle: meta('meta[property="og:title"]', 'content') ? cleanText(meta('meta[property="og:title"]', 'content')) : null,
    ogImage: ogImage ? normalizeImage(ogImage, baseUrl) : null,
    siteName: meta('meta[property="og:site_name"]', 'content') ? cleanText(meta('meta[property="og:site_name"]', 'content')) : null,
    canonical,
    description: meta('meta[name="description"]', 'content') ? cleanText(meta('meta[name="description"]', 'content')) : null,
  };
}

// ---------- Microdata ----------

function itempropValue(el: Element): string {
  const tag = el.name.toLowerCase();
  if (tag === 'meta') return attr(el, 'content') || '';
  if (tag === 'img') return attr(el, 'src') || attr(el, 'data-src') || '';
  if (tag === 'a' || tag === 'link') return attr(el, 'href') || '';
  if (tag === 'time') return attr(el, 'datetime') || text(el);
  if (tag === 'data' || tag === 'meter') return attr(el, 'value') || text(el);
  return text(el);
}

/** Find elements with a given itemprop inside a scope, not crossing into nested itemscopes of other types. */
function props(scope: Element, name: string): Element[] {
  const all = selectAll(`[itemprop~="${name}"]`, scope) as Element[];
  return all.filter((el) => el !== scope);
}

export function extractRecipeFromMicrodata(doc: ReturnType<typeof parseHtml>, pageUrl?: string): Recipe | null {
  const scopes = selectAll('[itemscope][itemtype*="schema.org/Recipe" i], [itemscope][itemtype*="schema.org/recipe" i]', doc) as unknown as Element[];
  if (!scopes.length) return null;
  // Choose scope with most ingredients.
  let best: Element | null = null;
  let bestCount = -1;
  for (const s of scopes) {
    const c = props(s, 'recipeIngredient').length + props(s, 'ingredients').length;
    if (c > bestCount) {
      best = s;
      bestCount = c;
    }
  }
  if (!best) return null;
  const scope = best;

  const ingLines = [...props(scope, 'recipeIngredient'), ...props(scope, 'ingredients')].map((el) => itempropValue(el));
  const stepEls = props(scope, 'recipeInstructions');
  let steps: string[] = [];
  for (const el of stepEls) {
    // A container of <li>s or <p>s, or an individual step element.
    const lis = selectAll('li, p', el) as Element[];
    if (lis.length > 1) steps.push(...lis.map((li) => text(li)));
    else steps.push(itempropValue(el));
  }
  // Nested HowToStep itemscopes
  if (!steps.length) {
    const howto = selectAll('[itemtype*="HowToStep" i]', scope) as Element[];
    steps = howto.map((el) => {
      const t = props(el, 'text')[0];
      return t ? itempropValue(t) : text(el);
    });
  }
  const ingredientGroups = groupIngredients(ingLines);
  const ingredients = ingredientGroups.flatMap((g) => g.items);
  const instructionGroups = normalizeInstructions(steps.filter(Boolean));
  const instructions = instructionGroups.flatMap((g) => g.items);
  if (!ingredients.length && !instructions.length) return null;

  const first = (name: string) => {
    const el = props(scope, name)[0];
    return el ? itempropValue(el) : null;
  };
  const prepMinutes = durationToMinutes(first('prepTime'));
  const cookMinutes = durationToMinutes(first('cookTime'));
  let totalMinutes = durationToMinutes(first('totalTime'));
  if (totalMinutes == null && (prepMinutes || cookMinutes)) totalMinutes = (prepMinutes || 0) + (cookMinutes || 0);
  const y = normalizeYield(first('recipeYield'));
  const imgEl = props(scope, 'image')[0];
  const image = imgEl ? normalizeImage(itempropValue(imgEl), pageUrl) : null;
  const authorEl = props(scope, 'author')[0];
  const authorName = authorEl ? (props(authorEl, 'name')[0] ? itempropValue(props(authorEl, 'name')[0]) : itempropValue(authorEl)) : null;

  const recipe: Recipe = {
    title: cleanText(first('name')) || 'Untitled Recipe',
    description: cleanText(first('description')) || null,
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
    author: authorName ? cleanText(authorName) : null,
    sourceUrl: pageUrl ?? null,
    extractedVia: 'microdata',
  };
  if (ingredientGroups.some((g) => g.name)) recipe.ingredientGroups = ingredientGroups as RecipeSection[];
  if (instructionGroups.some((g) => g.name)) recipe.instructionGroups = instructionGroups as RecipeSection[];
  return recipe;
}

// ---------- Structural heuristics ----------

const ING_HEADING = /^(ingredients?|what you.?ll need|you will need|shopping list)\b/i;
const STEP_HEADING = /^(instructions?|directions?|method|preparation|steps|how to make|procedure)\b/i;

function isHeading(el: Element): boolean {
  return /^h[1-6]$/i.test(el.name) || (el.name === 'p' && !!attr(el, 'class')?.match(/head|title/i)) || (el.name === 'strong' || el.name === 'b') && text(el).length < 40;
}

/** Walk following siblings (and their descendants) collecting list items until the next heading. */
function collectAfter(heading: Element, wantList: boolean): string[] {
  const out: string[] = [];
  let node: AnyNode | null = heading.next;
  let hops = 0;
  const parentHops = 0;
  // Sometimes the heading is wrapped in a div and the list is the parent's next sibling.
  if (!node && heading.parent && isTag(heading.parent)) node = (heading.parent as Element).next;
  while (node && hops < 40) {
    hops++;
    if (isTag(node)) {
      const el = node as Element;
      if (/^h[1-6]$/i.test(el.name)) break;
      const t = text(el);
      if (isHeading(el) && (ING_HEADING.test(t) || STEP_HEADING.test(t))) break;
      const lis = selectAll('li', el) as Element[];
      if (el.name === 'li') out.push(text(el));
      else if (lis.length) out.push(...lis.map((li) => text(li)));
      else if (!wantList && (el.name === 'p' || el.name === 'div') && t.length > 20 && lis.length === 0) {
        // Paragraph steps: split on numbered prefixes if present.
        const paras = selectAll('p', el) as Element[];
        if (paras.length > 1) out.push(...paras.map((p) => text(p)));
        else out.push(t);
      }
    }
    node = node.next;
    if (!node && parentHops === 0) break;
  }
  return out.filter((s) => s && s.length > 1);
}

/**
 * Last resort. Looks for an "Ingredients" heading + list and an "Instructions" heading + list/paragraphs.
 * Only succeeds when both are found and reasonably sized.
 */
export function extractRecipeFromStructure(doc: ReturnType<typeof parseHtml>, pageUrl?: string, meta?: PageMeta, opts?: { allowPartial?: boolean }): Recipe | null {
  const headings = selectAll('h1, h2, h3, h4, h5, p, strong, b, span, div', doc) as unknown as Element[];
  let ingHeading: Element | null = null;
  let stepHeading: Element | null = null;
  for (const el of headings) {
    // Only leaf-ish elements with short text.
    const kids = getChildren(el).filter(isTag);
    if (kids.length > 2) continue;
    const t = text(el);
    if (!t || t.length > 40) continue;
    if (!ingHeading && ING_HEADING.test(t)) ingHeading = el;
    else if (!stepHeading && STEP_HEADING.test(t)) stepHeading = el;
    if (ingHeading && stepHeading) break;
  }
  if (!ingHeading && !stepHeading) return null;
  const ingLines = ingHeading ? collectAfter(ingHeading, true).map(cleanIngredientLine).filter(Boolean) : [];
  const stepLines = stepHeading ? collectAfter(stepHeading, false).map((s) => stripStepNumbering(s)).filter(Boolean) : [];
  // Standalone use requires both halves; the caller may still borrow one half when JSON-LD had the other.
  const hasIng = ingLines.length >= 2 && ingLines.length <= 80;
  const hasSteps = stepLines.length >= 1 && stepLines.length <= 80;
  if (!hasIng && !hasSteps) return null;
  if (!opts?.allowPartial && !(hasIng && hasSteps)) return null;

  const ingredientGroups = groupIngredients(hasIng ? ingLines : []);
  const ingredients = ingredientGroups.flatMap((g) => g.items);
  const h1 = selectOne('h1', doc) as Element | null;
  const title = (h1 && text(h1)) || meta?.ogTitle || meta?.title || 'Untitled Recipe';
  const recipe: Recipe = {
    title: title.replace(/\s*[-|–]\s*[^-|–]{2,40}$/, '').trim() || title,
    description: meta?.description ?? null,
    ingredients,
    instructions: hasSteps ? stepLines : [],
    prepTime: null,
    cookTime: null,
    totalTime: null,
    servings: null,
    yieldCount: null,
    image: meta?.ogImage ?? null,
    sourceUrl: pageUrl ?? null,
    siteName: meta?.siteName ?? null,
    extractedVia: 'html',
  };
  if (ingredientGroups.some((g) => g.name)) recipe.ingredientGroups = ingredientGroups as RecipeSection[];
  return recipe;
}
