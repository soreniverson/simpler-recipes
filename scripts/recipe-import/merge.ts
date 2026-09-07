/**
 * Merge reviewed imports into the curated catalog.
 *
 * Assignment is evidence-based and ordered most-specific-first, so "Chicken noodle soup"
 * lands in Soups & Stews rather than Quick Weeknight Dinners. A recipe that matches nothing
 * is left out rather than dumped into a catch-all: an unconvincing collection entry is worse
 * than a smaller collection.
 */
import fs from 'node:fs';
import { review } from './review';
import { checkPantry } from '../../src/lib/recipe/pantry';
import type { StagedRecipe } from './extract';

/** Per-collection cap: the brief is 3-5 new recipes per existing category. */
const PER_THEME = 5;

/**
 * Prefer recipes that will actually look good on a card and a page: a real total time,
 * a sane number of ingredients, and enough steps to be worth following.
 */
function score(r: StagedRecipe): number {
  let s = 0;
  if (r.totalTime) s += 3;
  if (r.servings) s += 1;
  const ing = r.ingredients.length, st = r.instructions.length;
  if (ing >= 5 && ing <= 16) s += 2; else if (ing > 16) s -= 1;
  if (st >= 3 && st <= 12) s += 2; else if (st > 14) s -= 1;
  if (r.title.length <= 45) s += 1;
  return s;
}

const CATALOG = 'recipe-data/all-recipes.json';

/** [theme, test] — first match wins. */
const RULES: [string, RegExp][] = [
  ['Soups & Stews', /\b(soup|stew|chowder|bisque|broth|gumbo|casserole soup)\b/i],
  ['Desserts & Sweets', /\b(cake|cookie|brownie|pie|pudding|cobbler|crisp|custard|ambrosia|dessert|slice|muffin sweet|tart)\b/i],
  ['Baking Basics', /\b(bread|muffin|biscuit|scone|roll|cornbread|damper|pastry|pancake|waffle|crêpe|crepe|loaf|focaccia)\b/i],
  ['Breakfast & Brunch', /\b(breakfast|omelettes?|omelets?|frittatas?|scrambl|porridge|oat(meal|s)?|granola|smoothies?|toast|bircher|muesli)\b/i],
  ['Indian Cuisine', /\b(curry|masala|dal|tikka|biryani|samosa|paneer|chana|raita|naan)\b/i],
  ['Mexican Favorites', /\b(taco|burrito|quesadilla|enchilada|fajita|tostada|nacho|salsa|guacamole|mexican)\b/i],
  ['Italian Classics', /\b(pasta|spaghetti|lasagn|risotto|gnocchi|pizza|parmigiana|bolognese|carbonara|minestrone|italian)\b/i],
  ['Asian Inspired', /\b(stir[- ]?fry|fried rice|noodle|teriyaki|satay|dumpling|sushi|asian|thai|chinese|japanese|korean|vietnamese|laksa|pad )\b/i],
  ['Mediterranean & Mezze', /\b(hummus|tabbouleh|falafel|greek|couscous|tzatziki|mediterranean|pita|dolma|halloumi)\b/i],
  // NOTE: Grilling is handled separately below — it needs METHOD evidence, not a title match.
  ['Appetizers & Party Food', /\b(dips?|salsa|bruschetta|canap|finger food|party|snacks?|wings|deviled|devilled|scrolls?|pinwheels?|caviar|crackers|rice paper rolls?|pumpkin seeds)\b/i],
  ['One-Pot Meals', /\b(one[- ]pot|one[- ]pan|skillet|tray ?bake|sheet ?pan|hotpot|jambalaya|paella|hash|bake\b)\b/i],
  ['Healthy Lunches', /\b(salad|wrap|sandwich|roll|bowl|slaw|lunchbox|pita)\b/i],
  ['Vegetarian Mains', /\b(vegetable|veggie|vegetarian|lentil|chickpea|bean|tofu|mushroom|eggplant|frittata)\b/i],
  ['Comfort Food Classics', /\b(mac and cheese|macaroni|meatloaf|rissoles?|shepherd|cottage pie|pot pie|sloppy|gravy|mash|casseroles?|fish ?cakes?|patties|fritters?)\b/i],
  ['Quick Weeknight Dinners', /\b(quick|speedy|easy|minute|simple|weeknight|fast)\b/i],
];

/**
 * Grilling is the one category a title cannot establish: "Vegetarian burgers" is oven-baked,
 * and a burger is not a barbecue. Require the recipe's own METHOD to say so.
 */
function isGrilled(r: StagedRecipe): boolean {
  const method = r.instructions.join(' ');
  return /\b(grill|barbecue|bbq|char[- ]?grill|skewers?|kabobs?|kebabs?)\b/i.test(method);
}

function themeFor(r: StagedRecipe): string | null {
  // These were taken from Wikibooks' own "Indian recipes" category, so the source category is
  // the evidence — better than re-deriving it from keywords, which files Chapati under Baking.
  if (r.source?.name === 'Wikibooks Cookbook') return 'Indian Cuisine';
  if (isGrilled(r)) return 'Grilling & BBQ';
  const hay = `${r.title} ${r.ingredients.join(' ')}`;
  for (const [theme, re] of RULES) if (re.test(r.title)) return theme;
  for (const [theme, re] of RULES) if (re.test(hay)) return theme;
  return null;
}

function main() {
  const dry = process.argv.includes('--dry');
  const cat = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const batches = ['recipe-data/.staging/nutritiongov.json', 'recipe-data/.staging/nsw.json', 'recipe-data/.staging/wikibooks.json']
    .filter((p) => fs.existsSync(p))
    .flatMap((p) => JSON.parse(fs.readFileSync(p, 'utf8')) as StagedRecipe[]);

  const { clean, findings } = review(batches);
  console.log(`staged=${batches.length} passed-review=${clean.length} rejected=${batches.length - clean.length}`);

  // Group by theme, then take the best PER_THEME from each.
  const grouped = new Map<string, StagedRecipe[]>();
  let unassigned = 0;
  for (const r of clean) {
    const theme = themeFor(r);
    if (!theme) { unassigned++; continue; }
    if (!grouped.has(theme)) grouped.set(theme, []);
    grouped.get(theme)!.push(r);
  }
  const chosen = new Map<string, any>();
  const byTheme: Record<string, number> = {};
  for (const [theme, list] of grouped) {
    // Indian was the one category no other openly-licensed source could supply at all, so the
    // Wikibooks set is taken whole rather than capped — closing the gap is the point.
    const cap = theme === 'Indian Cuisine' ? list.length : PER_THEME;
    for (const r of [...list].sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title)).slice(0, cap)) {
      const { creator, ...rest } = r as any;
      chosen.set(r.slug, { ...rest, theme });
    }
  }
  // The new Empty-Fridge page is a headline feature; keep every recipe that propagates it
  // even when its own collection is already full, so the page has real depth.
  let extraForPantry = 0;
  for (const [theme, list] of grouped) {
    for (const r of list) {
      if (chosen.has(r.slug) || !checkPantry(r.ingredients).ok) continue;
      const { creator, ...rest } = r as any;
      chosen.set(r.slug, { ...rest, theme });
      extraForPantry++;
    }
  }
  const accepted = [...chosen.values()];
  for (const r of accepted) byTheme[r.theme] = (byTheme[r.theme] || 0) + 1;
  console.log(`assigned=${accepted.length} (cap ${PER_THEME}/theme, +${extraForPantry} kept for Empty-Fridge) unassigned=${unassigned}\n`);
  for (const c of cat.collections) {
    const before = c.recipes.length;
    console.log(`  ${c.name.padEnd(26)} ${String(before).padStart(3)} + ${String(byTheme[c.name] || 0).padStart(2)} new`);
  }
  if (dry) { console.log('\n--dry: nothing written'); return; }

  // Append recipes and extend each collection's slug list.
  cat.recipes.push(...accepted);
  const bySlugTheme = new Map<string, string[]>();
  for (const r of accepted) {
    if (!bySlugTheme.has(r.theme)) bySlugTheme.set(r.theme, []);
    bySlugTheme.get(r.theme)!.push(r.slug);
  }
  for (const c of cat.collections) {
    const add = bySlugTheme.get(c.name) || [];
    c.recipes = [...new Set([...c.recipes, ...add])];
    c.recipeCount = c.recipes.length;
  }
  cat.metadata.totalRecipes = cat.recipes.length;
  cat.metadata.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CATALOG, JSON.stringify(cat, null, 2));
  console.log(`\nwrote ${CATALOG}: ${cat.recipes.length} recipes`);
  if (findings.length) console.log(`(${findings.length} review findings excluded)`);
}
main();
