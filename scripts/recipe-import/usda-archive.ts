/**
 * Parse a recipe out of an ARCHIVED myplate.gov page.
 *
 * Why not read the live mirrors: myplate.gov was retired 2026-01-07, and the surviving
 * mirror licenses *its own edition* (cleaned data, AI-remastered images) for commercial
 * reuse. The archived federal page is the original work — public domain under 17 USC §105 —
 * so title, ingredients, directions, yield, times and photograph all come from here and
 * nothing depends on a third party's terms.
 *
 * USDA served a consistent Drupal template, so this is a targeted parse, not a heuristic:
 *   ingredients  .field--name-field-mp-ingredients li.field__item  (+ span.notes)
 *   directions   .field--name-field-instructions ol > li
 *   yield/times  .mp-recipe-full__detail--label / --data pairs
 */
import { parseDocument } from 'htmlparser2';
import { selectAll, selectOne } from 'css-select';
import { textContent } from 'domutils';
import { safeFetch } from '../../src/lib/safeFetch';
import { cleanIngredientLine, cleanText, stripStepNumbering, formatMinutes } from '../../src/lib/recipe/normalize';

export interface UsdaRecipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  servings: string | null;
  prepTime: string | null;
  cookTime: string | null;
  totalTime: string | null;
  description: string | null;
  /** Original USDA image URL (un-proxied), or null. */
  imageUrl: string | null;
  archivedUrl: string;
  /** USDA's own "Source:" credit line, verbatim. Empty when USDA authored it themselves. */
  sourceCredit: string | null;
}

/** Snapshot date to request: mid-2024, comfortably before the site was retired. */
const SNAPSHOT = '20240601';

const tidy = (s: string) => cleanText(s.replace(/ /g, ' ')).trim();
/** textContent that tolerates a missing node — many pages omit the optional blocks. */
const textOf = (node: unknown): string => (node ? tidy(textContent(node as any)) : '');

function minutesFrom(s: string): number | null {
  const h = /(\d+)\s*(?:hours?|hrs?)/i.exec(s);
  const m = /(\d+)\s*(?:minutes?|mins?)/i.exec(s);
  const n = (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
  return n > 0 && n < 24 * 60 ? n : null;
}

export async function fetchUsdaArchive(govSlug: string): Promise<UsdaRecipe | null> {
  const target = `https://www.myplate.gov/recipes/${govSlug}`;
  let html: string;
  try {
    // Pre-retirement capture: myplate.gov went dark 2026-01-07 and later snapshots are empty shells.
    const res = await safeFetch(`https://web.archive.org/web/${SNAPSHOT}/${target}`, { maxBytes: 8_000_000 });
    html = res.body;
  } catch { return null; }
  const doc = parseDocument(html);

  const title = textOf(selectOne('h1', doc));
  if (!title) return null;

  // USDA served two template generations; the ingredient block is named differently in each.
  const ingredients = selectAll('.field--name-field-ingredients li.field__item, .field--name-field-mp-ingredients li.field__item', doc)
    .map((li) => cleanIngredientLine(tidy(textContent(li))))
    .filter(Boolean);

  const instructions = selectAll('.field--name-field-instructions ol li, .field--name-field-instructions .field__item li', doc)
    .map((li) => stripStepNumbering(tidy(textContent(li))))
    .filter((s) => s.length > 2);

  // "Makes: 8 servings" / "Cook Time: 20 minutes" label-data pairs.
  const details: Record<string, string> = {};
  for (const wrap of selectAll('.mp-recipe-full__detail', doc)) {
    const label = textOf(selectOne('.mp-recipe-full__detail--label', wrap)).replace(/:$/, '').toLowerCase();
    const data = textOf(selectOne('.mp-recipe-full__detail--data', wrap));
    if (label && data) details[label] = data;
  }
  const prep = details['prep time'] ? minutesFrom(details['prep time']) : null;
  const cook = details['cook time'] ? minutesFrom(details['cook time']) : null;
  const total = details['total time'] ? minutesFrom(details['total time']) : null;

  // Archived srcs are Wayback-proxied (/web/<ts>im_/<original>); recover the underlying USDA
  // URL from anywhere in the document (og:image carries it even when <img> is lazy-loaded).
  const m = html.match(/https?:\/\/(?:myplate-prod\.azureedge\.us|www\.myplate\.gov)\/sites\/default\/files\/[^"'\s\\]+\.(?:jpg|jpeg|png)/i);

  const desc = textOf(selectOne('.mp-recipe-full__description', doc)) || null;
  // Provenance gate input: a .gov URL does NOT make a recipe a federal work. MyPlate hosted a
  // great many recipes contributed by state universities and nonprofits, which are not covered
  // by 17 USC §105. This credit line is how each recipe declares who actually wrote it.
  const sourceCredit = textOf(selectOne('.field--name-field-source .field__item', doc)).replace(/^Source:\s*/i, '') || null;

  return {
    title, ingredients, instructions,
    servings: details['makes'] || details['servings'] || null,
    prepTime: formatMinutes(prep), cookTime: formatMinutes(cook),
    totalTime: formatMinutes(total ?? (prep != null || cook != null ? (prep || 0) + (cook || 0) : null)),
    description: desc,
    imageUrl: m ? m[0] : null,
    sourceCredit,
    archivedUrl: `https://web.archive.org/web/${SNAPSHOT}/${target}`,
  };
}

if (process.argv[2]) {
  fetchUsdaArchive(process.argv[2]).then((r) => {
    if (!r) return console.log('NULL');
    console.log(`${r.title}\n  ing=${r.ingredients.length} steps=${r.instructions.length} makes=${r.servings} prep=${r.prepTime} cook=${r.cookTime} total=${r.totalTime}`);
    console.log('  img:', r.imageUrl);
    console.log('  ing[0..2]:', r.ingredients.slice(0,3));
    console.log('  step[0]:', r.instructions[0]);
  });
}
