/**
 * Programmatic "browse" landing pages built from the curated catalog.
 *
 * Every page here answers a real search intent ("chicken thigh recipes", "30 minute dinners"),
 * has a hand-written intro, and is skipped at build if it would have fewer than MIN_RECIPES
 * results — we'd rather ship 15 useful pages than 200 thin ones.
 *
 * This registry is the single source of truth for the search surface: routing, the browse
 * index, sitemap lastmod, and the seasonal calendar all read it. Matchers are deterministic
 * (pure functions of catalog data), so two builds of the same catalog produce identical pages.
 * Candidates that don't clear the gate live in docs/search/launch-manifest.json as drafts.
 */
import { durationToMinutes } from './recipe/units';
import { checkPantry } from './recipe/pantry';

export interface CatalogRecipe {
  slug: string;
  title: string;
  image: string | null;
  totalTime: string | null;
  servings: string | null;
  ingredients: string[];
  tags?: string[];
  theme?: string;
}

export type PageFamily = 'ingredient' | 'time' | 'method' | 'cuisine' | 'dish' | 'occasion' | 'combo';

/** A page that gets promoted/refreshed for a recurring window but stays live year-round. */
export interface SeasonalWindow {
  /** Human name of the window, e.g. "Summer grilling". */
  window: string;
  /** 1-12; the month interest peaks (US audience). */
  peakMonth: number;
  /** Month-day to refresh/promote by, ~6 weeks ahead of the peak. */
  refreshBy: string;
}

export interface BrowsePage {
  slug: string;
  name: string;
  /** One or two plain sentences. Not marketing. */
  intro: string;
  /** What someone typed into a search box to deserve this page. One page per intent. */
  intent: string;
  family: PageFamily;
  /** First published (real date — sitemap lastmod floor, never the build timestamp). */
  published: string;
  seasonal?: SeasonalWindow;
  match: (r: CatalogRecipe) => boolean;
}

export const MIN_RECIPES = 8;

const mins = (r: CatalogRecipe) => durationToMinutes(r.totalTime);
const t = (r: CatalogRecipe, re: RegExp) => re.test(r.title);
const tag = (r: CatalogRecipe, ...tags: string[]) => (r.tags || []).some((x) => tags.includes(x));
const ing = (r: CatalogRecipe, re: RegExp) => r.ingredients.some((i) => re.test(i));
const theme = (r: CatalogRecipe, re: RegExp) => re.test(r.theme || '');
const NOT_MAIN = (r: CatalogRecipe) => tag(r, 'dessert', 'sweet', 'baking', 'breakfast', 'brunch', 'appetizer', 'snack') || /Desserts|Baking|Breakfast|Appetizers/.test(r.theme || '');
const servingsN = (r: CatalogRecipe) => {
  const m = String(r.servings || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};

export const BROWSE_PAGES: BrowsePage[] = [
  // ---- Launched 2026-08-14 ----
  {
    slug: 'chicken',
    name: 'Chicken recipes',
    intent: 'chicken recipes',
    family: 'ingredient',
    published: '2026-08-14',
    intro: 'Weeknight chicken in every form — thighs, breasts, whole roasts, curries and soups. Each one is just the ingredients and the steps.',
    match: (r) => t(r, /chicken/i) || tag(r, 'poultry'),
  },
  {
    slug: 'chicken-thighs',
    name: 'Chicken thigh recipes',
    intent: 'chicken thigh recipes',
    family: 'ingredient',
    published: '2026-08-14',
    intro: 'Thighs stay juicy and forgive a few extra minutes in the pan. These recipes call for them specifically.',
    match: (r) => ing(r, /chicken thigh/i),
  },
  {
    slug: 'chicken-breast',
    name: 'Chicken breast recipes',
    intent: 'chicken breast recipes',
    family: 'ingredient',
    published: '2026-08-14',
    intro: 'Quick-cooking and lean. Recipes that use chicken breast, from stir-fries to tray bakes.',
    match: (r) => ing(r, /chicken breast/i),
  },
  {
    slug: '30-minute-dinners',
    name: '30-minute dinners',
    intent: '30 minute dinners',
    family: 'time',
    published: '2026-08-14',
    intro: 'Dinners with a total time of 30 minutes or less, by the recipe’s own clock. No “quick” marketing — just the timing.',
    match: (r) => { const m = mins(r); return m != null && m <= 30 && !NOT_MAIN(r); },
  },
  {
    slug: '20-minute-recipes',
    name: '20-minute recipes',
    intent: '20 minute meals',
    family: 'time',
    published: '2026-08-14',
    intro: 'Everything here is done in 20 minutes or less, start to finish.',
    match: (r) => { const m = mins(r); return m != null && m <= 20; },
  },
  {
    slug: 'vegetarian',
    name: 'Vegetarian recipes',
    intent: 'vegetarian recipes',
    family: 'ingredient',
    published: '2026-08-14',
    intro: 'Meat-free recipes across the whole catalog — mains, soups, salads and sides. Ingredient lists are checked, not just tagged.',
    match: (r) => tag(r, 'vegetarian'),
  },
  {
    slug: 'vegetarian-dinners',
    name: 'Vegetarian dinners',
    intent: 'vegetarian dinner ideas',
    family: 'occasion',
    published: '2026-08-14',
    intro: 'Vegetarian mains that work as the whole meal.',
    match: (r) => tag(r, 'vegetarian') && !NOT_MAIN(r),
  },
  {
    slug: 'quick-vegetarian',
    name: 'Quick vegetarian meals',
    intent: 'quick vegetarian meals',
    family: 'combo',
    published: '2026-08-14',
    intro: 'Vegetarian recipes ready in 30 minutes or less.',
    match: (r) => { const m = mins(r); return tag(r, 'vegetarian') && m != null && m <= 30; },
  },
  {
    slug: 'pasta',
    name: 'Pasta recipes',
    intent: 'pasta recipes',
    family: 'dish',
    published: '2026-08-14',
    intro: 'Pasta, noodles, lasagne and everything saucy. Most of these are one pot and under an hour.',
    match: (r) => t(r, /pasta|spaghetti|lasagn|fettuccin|penne|mac(aroni)? and cheese|carbonara|linguine|gnocchi|alfredo|bolognese|noodle|cannelloni|ravioli|orzo|rigatoni/i) || tag(r, 'pasta'),
  },
  {
    slug: 'soup',
    name: 'Soup recipes',
    intent: 'soup recipes',
    family: 'dish',
    published: '2026-08-14',
    seasonal: { window: 'Fall & winter soups', peakMonth: 1, refreshBy: '11-15' },
    intro: 'Soups, chowders and broths — the kind you can make on a Sunday and eat all week.',
    match: (r) => t(r, /soup|chowder|bisque|broth|ramen|pho\b|laksa|minestrone/i) || tag(r, 'soup'),
  },
  {
    slug: 'beef',
    name: 'Beef recipes',
    intent: 'beef recipes',
    family: 'ingredient',
    published: '2026-08-14',
    intro: 'Steak, stews, meatballs, chili and stroganoff. Slow braises and fast pan dinners.',
    match: (r) => t(r, /\bbeef|steak|brisket|meatball|burger|bolognese|stroganoff|chili con|meatloaf/i) || ing(r, /\b(ground|minced) beef|beef mince|beef (chuck|stew|steak)/i),
  },
  {
    slug: 'ground-beef',
    name: 'Ground beef recipes',
    intent: 'ground beef recipes',
    family: 'ingredient',
    published: '2026-08-14',
    intro: 'Recipes built on a pack of ground beef: meatballs, meatloaf, tacos, chili and bolognese.',
    match: (r) => ing(r, /ground beef|beef mince|minced beef|lean beef/i) || t(r, /meatball|meatloaf|bolognese/i),
  },
  {
    slug: 'curry',
    name: 'Curry recipes',
    intent: 'curry recipes',
    family: 'dish',
    published: '2026-08-14',
    intro: 'Curries from Indian, Thai and everywhere in between, with the spice list laid out clearly.',
    match: (r) => t(r, /curry|tikka|masala|korma|vindaloo|\bdal\b|dahl|rogan|biryani|laksa/i) || tag(r, 'curry'),
  },
  {
    slug: 'salads',
    name: 'Salad recipes',
    intent: 'salad recipes',
    family: 'dish',
    published: '2026-08-14',
    intro: 'Salads that count as a meal, plus a few sides. Dressings included in the ingredient list.',
    match: (r) => t(r, /salad|slaw/i) || tag(r, 'salad'),
  },
  {
    slug: 'seafood',
    name: 'Seafood recipes',
    intent: 'seafood recipes',
    family: 'ingredient',
    published: '2026-08-14',
    intro: 'Salmon, shrimp, cod and more. Most cook in under 30 minutes.',
    match: (r) => t(r, /salmon|shrimp|prawn|fish|cod\b|tuna|scampi|seafood|crab|scallop|mussel|cioppino/i) || tag(r, 'seafood'),
  },
  {
    slug: 'desserts',
    name: 'Dessert recipes',
    intent: 'dessert recipes',
    family: 'dish',
    published: '2026-08-14',
    intro: 'Cakes, cookies, pies and puddings — with the method laid out step by step.',
    match: (r) => tag(r, 'dessert', 'sweet') || /Desserts/.test(r.theme || ''),
  },
  {
    slug: 'comfort-food',
    name: 'Comfort food',
    intent: 'comfort food recipes',
    family: 'occasion',
    published: '2026-08-14',
    intro: 'The recipes you make when it’s cold, late, or both.',
    match: (r) => tag(r, 'comfort', 'comfort-food') || /Comfort/.test(r.theme || ''),
  },
  {
    slug: 'for-two',
    name: 'Recipes for two',
    intent: 'dinner for two',
    family: 'occasion',
    published: '2026-08-14',
    intro: 'Recipes that already make one or two servings — no halving maths (though you can scale any recipe on the page).',
    match: (r) => { const n = servingsN(r); return n != null && n <= 2; },
  },
  {
    slug: 'for-a-crowd',
    name: 'Recipes for a crowd',
    intent: 'recipes for a crowd',
    family: 'occasion',
    published: '2026-08-14',
    intro: 'Recipes that make eight or more servings as written. Good for parties, potlucks and meal prep.',
    match: (r) => { const n = servingsN(r); return n != null && n >= 8; },
  },
  {
    slug: 'dips',
    name: 'Dip recipes',
    intent: 'dip recipes',
    family: 'dish',
    published: '2026-08-14',
    intro: 'Hummus, guacamole, tzatziki and baked dips. Most take ten minutes.',
    match: (r) => t(r, /\bdip\b|hummus|guacamole|salsa|tzatziki/i),
  },

  // ---- Launched 2026-09-06 (search spike) ----
  {
    slug: 'shrimp',
    name: 'Shrimp recipes',
    intent: 'shrimp recipes',
    family: 'ingredient',
    published: '2026-09-06',
    intro: 'Shrimp cooks in minutes. Everything here calls for shrimp or prawns — pastas, curries, soups and starters.',
    match: (r) => ing(r, /\bshrimp|\bprawn/i) || t(r, /shrimp|prawn/i),
  },
  {
    slug: 'rice-dishes',
    name: 'Rice dishes',
    intent: 'rice recipes',
    family: 'dish',
    published: '2026-09-06',
    intro: 'Fried rice, risotto, biryani and rice bowls — dinners where the rice is the point, not the side.',
    match: (r) => t(r, /\brice\b|risotto|biryani|paella/i),
  },
  {
    slug: 'one-pot',
    name: 'One-pot meals',
    intent: 'one pot meals',
    family: 'method',
    published: '2026-09-06',
    intro: 'Whole dinners in a single pot, pan or skillet, so cleanup is one thing, not five.',
    match: (r) => tag(r, 'one-pot') || theme(r, /One-Pot/) || t(r, /one[- ]pot|one[- ]pan|\bskillet\b/i),
  },
  {
    slug: 'breakfast',
    name: 'Breakfast recipes',
    intent: 'breakfast recipes',
    family: 'occasion',
    published: '2026-09-06',
    intro: 'Pancakes, eggs, waffles and the rest of the morning canon — each just the ingredients and the steps.',
    match: (r) => tag(r, 'breakfast', 'brunch') || theme(r, /Breakfast/),
  },
  {
    slug: 'baking',
    name: 'Baking recipes',
    intent: 'baking recipes',
    family: 'dish',
    published: '2026-09-06',
    seasonal: { window: 'Holiday baking', peakMonth: 12, refreshBy: '10-20' },
    intro: 'Cookies, muffins, breads and cakes with measured quantities you can trust — nothing paraphrased, nothing invented.',
    match: (r) => tag(r, 'baking') || theme(r, /Baking/),
  },
  {
    slug: 'party-food',
    name: 'Appetizers & party food',
    intent: 'party appetizers',
    family: 'occasion',
    published: '2026-09-06',
    seasonal: { window: 'Game-day snacks (Super Bowl)', peakMonth: 2, refreshBy: '12-20' },
    intro: 'Dips, wings, nachos and small things people stand around and finish. Most scale up easily.',
    match: (r) => tag(r, 'appetizer', 'snack') || theme(r, /Appetizers|Party/),
  },
  {
    slug: 'grilling',
    name: 'Grilling & BBQ recipes',
    intent: 'grilling recipes',
    family: 'method',
    published: '2026-09-06',
    seasonal: { window: 'Summer grilling', peakMonth: 7, refreshBy: '05-15' },
    intro: 'Grilled chicken, ribs, pulled pork and sides — from the catalog’s Grilling & BBQ shelf, marinades included.',
    match: (r) => tag(r, 'grilling', 'bbq') || theme(r, /Grilling/),
  },
  {
    slug: 'indian',
    name: 'Indian recipes',
    intent: 'indian recipes',
    family: 'cuisine',
    published: '2026-09-06',
    intro: 'Tikka masala, butter chicken, chana masala and more, with the full spice list spelled out.',
    match: (r) => tag(r, 'indian') || theme(r, /Indian/),
  },
  {
    slug: 'italian',
    name: 'Italian recipes',
    intent: 'italian recipes',
    family: 'cuisine',
    published: '2026-09-06',
    intro: 'Carbonara, parmigiana, risotto and the classics — written as steps, not as a memoir of Rome.',
    match: (r) => tag(r, 'italian') || theme(r, /Italian/),
  },
  {
    slug: 'asian',
    name: 'Asian-inspired recipes',
    intent: 'asian recipes',
    family: 'cuisine',
    published: '2026-09-06',
    intro: 'Stir-fries, noodles, curries and rice bowls from the catalog’s Asian-inspired shelf.',
    match: (r) => tag(r, 'asian') || theme(r, /Asian/),
  },
  {
    slug: 'mediterranean',
    name: 'Mediterranean recipes',
    intent: 'mediterranean recipes',
    family: 'cuisine',
    published: '2026-09-06',
    intro: 'Hummus, tabbouleh, koftas and mezze-table food — olive oil, lemon and herbs doing the work.',
    match: (r) => theme(r, /Mediterranean/) || tag(r, 'mediterranean', 'greek'),
  },
  {
    slug: 'mexican',
    name: 'Mexican-inspired recipes',
    intent: 'mexican food recipes',
    family: 'cuisine',
    published: '2026-09-06',
    intro: 'Tacos, carnitas, enchiladas, guacamole — Mexican and Tex-Mex favorites with honest quantities.',
    match: (r) => tag(r, 'mexican') || t(r, /taco|burrito|quesadilla|enchilada|fajita|carnitas|elote|guacamole|salsa|refried|nacho/i),
  },
  {
    slug: 'chicken-and-rice',
    name: 'Chicken and rice recipes',
    intent: 'chicken and rice recipes',
    family: 'combo',
    published: '2026-09-06',
    intro: 'Both in one dish: fried rice, curries, casseroles and bowls where chicken and rice carry the meal together.',
    match: (r) => (t(r, /chicken/i) || tag(r, 'poultry')) && (ing(r, /\brice\b/i) || t(r, /\brice\b/i)),
  },
  {
    slug: 'potatoes',
    name: 'Recipes with potatoes',
    intent: 'potato recipes',
    family: 'ingredient',
    published: '2026-09-06',
    intro: 'Dinners and sides that use potatoes — mashed, roasted, in stews and on sheet pans.',
    match: (r) => ing(r, /\bpotato/i) || t(r, /potato/i),
  },
  {
    slug: 'pork',
    name: 'Pork recipes',
    intent: 'pork recipes',
    family: 'ingredient',
    published: '2026-09-06',
    intro: 'Pulled pork, ribs, chops and stir-fries — recipes where pork is the main event.',
    match: (r) => t(r, /\bpork|carnitas/i) || ing(r, /pork (shoulder|butt|loin|tenderloin|chop|belly|rib|mince)|ground pork/i),
  },
  {
    slug: 'eggs',
    name: 'Egg recipes',
    intent: 'egg recipes',
    family: 'dish',
    published: '2026-09-06',
    intro: 'Scrambled, poached, baked and devilled — recipes where eggs are the dish, not just a binder.',
    match: (r) => t(r, /\beggs?\b|omelet|frittata|shakshuka|benedict/i),
  },
  {
    slug: 'empty-fridge',
    name: 'Empty-Fridge Cooking',
    intent: 'recipes with no fresh ingredients',
    family: 'method',
    published: '2026-09-07',
    intro:
      'Every ingredient is shelf-stable, frozen, or a long-keeper you probably already have — no shopping trip. Each recipe is checked ingredient by ingredient; anything calling for fresh meat, fresh herbs or salad leaves is left out.',
    // Evidence, not vibes: the shared pantry rule reads the actual ingredient list and fails
    // closed on anything it cannot place, so the page can never quietly include a recipe that
    // needs a shop. See tests/pantry.test.ts.
    match: (r) => checkPantry(r.ingredients).ok,
  },
  {
    slug: 'healthy-dinners',
    name: 'Healthy dinners',
    intent: 'healthy dinner ideas',
    family: 'occasion',
    published: '2026-09-06',
    seasonal: { window: 'New Year reset', peakMonth: 1, refreshBy: '11-20' },
    intro: 'Dinners the catalog tags healthy — lighter mains, big salads and vegetable-forward plates. “Healthy” here means the source recipe says so, not a nutrition claim.',
    match: (r) => tag(r, 'healthy') && !NOT_MAIN(r),
  },
];

export interface BuiltBrowsePage extends Omit<BrowsePage, 'match'> {
  recipes: CatalogRecipe[];
}

/** Resolve pages against the catalog, dropping thin ones. Deterministic order: shortest total time first, then title. */
export function buildBrowsePages(catalog: CatalogRecipe[]): BuiltBrowsePage[] {
  return BROWSE_PAGES.map(({ match, ...meta }) => {
    const recipes = catalog
      .filter(match)
      .sort((a, b) => (mins(a) ?? 9999) - (mins(b) ?? 9999) || a.title.localeCompare(b.title));
    return { ...meta, recipes };
  }).filter((p) => p.recipes.length >= MIN_RECIPES);
}
