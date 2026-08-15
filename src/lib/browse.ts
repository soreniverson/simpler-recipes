/**
 * Programmatic "browse" landing pages built from the curated catalog.
 *
 * Every page here answers a real search intent ("chicken thigh recipes", "30 minute dinners"),
 * has a hand-written intro, and is skipped at build if it would have fewer than MIN_RECIPES
 * results — we'd rather ship 15 useful pages than 200 thin ones.
 */
import { durationToMinutes } from './recipe/units';

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

export interface BrowsePage {
  slug: string;
  name: string;
  /** One or two plain sentences. Not marketing. */
  intro: string;
  match: (r: CatalogRecipe) => boolean;
}

export const MIN_RECIPES = 8;

const mins = (r: CatalogRecipe) => durationToMinutes(r.totalTime);
const t = (r: CatalogRecipe, re: RegExp) => re.test(r.title);
const tag = (r: CatalogRecipe, ...tags: string[]) => (r.tags || []).some((x) => tags.includes(x));
const ing = (r: CatalogRecipe, re: RegExp) => r.ingredients.some((i) => re.test(i));
const NOT_MAIN = (r: CatalogRecipe) => tag(r, 'dessert', 'sweet', 'baking', 'breakfast', 'brunch', 'appetizer', 'snack') || /Desserts|Baking|Breakfast|Appetizers/.test(r.theme || '');
const servingsN = (r: CatalogRecipe) => {
  const m = String(r.servings || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};

export const BROWSE_PAGES: BrowsePage[] = [
  {
    slug: 'chicken',
    name: 'Chicken recipes',
    intro: 'Weeknight chicken in every form — thighs, breasts, whole roasts, curries and soups. Each one is just the ingredients and the steps.',
    match: (r) => t(r, /chicken/i) || tag(r, 'poultry'),
  },
  {
    slug: 'chicken-thighs',
    name: 'Chicken thigh recipes',
    intro: 'Thighs stay juicy and forgive a few extra minutes in the pan. These recipes call for them specifically.',
    match: (r) => ing(r, /chicken thigh/i),
  },
  {
    slug: 'chicken-breast',
    name: 'Chicken breast recipes',
    intro: 'Quick-cooking and lean. Recipes that use chicken breast, from stir-fries to tray bakes.',
    match: (r) => ing(r, /chicken breast/i),
  },
  {
    slug: '30-minute-dinners',
    name: '30-minute dinners',
    intro: 'Dinners with a total time of 30 minutes or less, by the recipe’s own clock. No “quick” marketing — just the timing.',
    match: (r) => { const m = mins(r); return m != null && m <= 30 && !NOT_MAIN(r); },
  },
  {
    slug: '20-minute-recipes',
    name: '20-minute recipes',
    intro: 'Everything here is done in 20 minutes or less, start to finish.',
    match: (r) => { const m = mins(r); return m != null && m <= 20; },
  },
  {
    slug: 'vegetarian',
    name: 'Vegetarian recipes',
    intro: 'Meat-free recipes across the whole catalog — mains, soups, salads and sides. Ingredient lists are checked, not just tagged.',
    match: (r) => tag(r, 'vegetarian'),
  },
  {
    slug: 'vegetarian-dinners',
    name: 'Vegetarian dinners',
    intro: 'Vegetarian mains that work as the whole meal.',
    match: (r) => tag(r, 'vegetarian') && !NOT_MAIN(r),
  },
  {
    slug: 'quick-vegetarian',
    name: 'Quick vegetarian meals',
    intro: 'Vegetarian recipes ready in 30 minutes or less.',
    match: (r) => { const m = mins(r); return tag(r, 'vegetarian') && m != null && m <= 30; },
  },
  {
    slug: 'pasta',
    name: 'Pasta recipes',
    intro: 'Pasta, noodles, lasagne and everything saucy. Most of these are one pot and under an hour.',
    match: (r) => t(r, /pasta|spaghetti|lasagn|fettuccin|penne|mac(aroni)? and cheese|carbonara|linguine|gnocchi|alfredo|bolognese|noodle|cannelloni|ravioli|orzo|rigatoni/i) || tag(r, 'pasta'),
  },
  {
    slug: 'soup',
    name: 'Soup recipes',
    intro: 'Soups, chowders and broths — the kind you can make on a Sunday and eat all week.',
    match: (r) => t(r, /soup|chowder|bisque|broth|ramen|pho\b|laksa|minestrone/i) || tag(r, 'soup'),
  },
  {
    slug: 'beef',
    name: 'Beef recipes',
    intro: 'Steak, stews, meatballs, chili and stroganoff. Slow braises and fast pan dinners.',
    match: (r) => t(r, /\bbeef|steak|brisket|meatball|burger|bolognese|stroganoff|chili con|meatloaf/i) || ing(r, /\b(ground|minced) beef|beef mince|beef (chuck|stew|steak)/i),
  },
  {
    slug: 'ground-beef',
    name: 'Ground beef recipes',
    intro: 'Recipes built on a pack of ground beef: meatballs, meatloaf, tacos, chili and bolognese.',
    match: (r) => ing(r, /ground beef|beef mince|minced beef|lean beef/i) || t(r, /meatball|meatloaf|bolognese/i),
  },
  {
    slug: 'curry',
    name: 'Curry recipes',
    intro: 'Curries from Indian, Thai and everywhere in between, with the spice list laid out clearly.',
    match: (r) => t(r, /curry|tikka|masala|korma|vindaloo|\bdal\b|dahl|rogan|biryani|laksa/i) || tag(r, 'curry'),
  },
  {
    slug: 'salads',
    name: 'Salad recipes',
    intro: 'Salads that count as a meal, plus a few sides. Dressings included in the ingredient list.',
    match: (r) => t(r, /salad|slaw/i) || tag(r, 'salad'),
  },
  {
    slug: 'seafood',
    name: 'Seafood recipes',
    intro: 'Salmon, shrimp, cod and more. Most cook in under 30 minutes.',
    match: (r) => t(r, /salmon|shrimp|prawn|fish|cod\b|tuna|scampi|seafood|crab|scallop|mussel|cioppino/i) || tag(r, 'seafood'),
  },
  {
    slug: 'desserts',
    name: 'Dessert recipes',
    intro: 'Cakes, cookies, pies and puddings — with the method laid out step by step.',
    match: (r) => tag(r, 'dessert', 'sweet') || /Desserts/.test(r.theme || ''),
  },
  {
    slug: 'comfort-food',
    name: 'Comfort food',
    intro: 'The recipes you make when it’s cold, late, or both.',
    match: (r) => tag(r, 'comfort', 'comfort-food') || /Comfort/.test(r.theme || ''),
  },
  {
    slug: 'for-two',
    name: 'Recipes for two',
    intro: 'Recipes that already make one or two servings — no halving maths (though you can scale any recipe on the page).',
    match: (r) => { const n = servingsN(r); return n != null && n <= 2; },
  },
  {
    slug: 'for-a-crowd',
    name: 'Recipes for a crowd',
    intro: 'Recipes that make eight or more servings as written. Good for parties, potlucks and meal prep.',
    match: (r) => { const n = servingsN(r); return n != null && n >= 8; },
  },
  {
    slug: 'dips',
    name: 'Dip recipes',
    intro: 'Hummus, guacamole, tzatziki and baked dips. Most take ten minutes.',
    match: (r) => t(r, /\bdip\b|hummus|guacamole|salsa|tzatziki/i),
  },
];

export interface BuiltBrowsePage extends Omit<BrowsePage, 'match'> {
  recipes: CatalogRecipe[];
}

/** Resolve pages against the catalog, dropping thin ones. Deterministic order: shortest total time first, then title. */
export function buildBrowsePages(catalog: CatalogRecipe[]): BuiltBrowsePage[] {
  return BROWSE_PAGES.map((p) => {
    const recipes = catalog
      .filter(p.match)
      .sort((a, b) => (mins(a) ?? 9999) - (mins(b) ?? 9999) || a.title.localeCompare(b.title));
    return { slug: p.slug, name: p.name, intro: p.intro, recipes };
  }).filter((p) => p.recipes.length >= MIN_RECIPES);
}
