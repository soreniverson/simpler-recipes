/**
 * The internal Recipe model produced by every extraction path.
 *
 * Backwards-compatible with what the client, KV cache, share links and favorites already
 * store (`title, ingredients[], instructions[], prepTime, cookTime, servings, image`), with
 * additive fields for richer rendering. Old cached objects simply lack the new fields.
 */
export interface RecipeSection {
  /** Group heading ("For the sauce"), or null for the unnamed/default group. */
  name: string | null;
  items: string[];
}

export type ExtractionMethod = 'jsonld' | 'microdata' | 'html' | 'ai' | 'youtube' | 'remix' | 'unknown';

export interface Recipe {
  title: string;
  description: string | null;

  /** Flat lists — always populated (concatenation of the groups). */
  ingredients: string[];
  instructions: string[];
  /** Grouped versions; only present when there is at least one named group. */
  ingredientGroups?: RecipeSection[];
  instructionGroups?: RecipeSection[];

  /** Human strings: "1 hr 30 min". */
  prepTime: string | null;
  cookTime: string | null;
  totalTime: string | null;
  /** Numeric minutes for scaling / schema output. */
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;

  /** Human yield: "4 servings", "12 cookies". */
  servings: string | null;
  /** Numeric yield for scaling; null when unknown so the UI must not invent one. */
  yieldCount?: number | null;

  image: string | null;

  /** Provenance. */
  author?: string | null;
  siteName?: string | null;
  /** The URL the user submitted (normalized) — where the recipe lives. */
  sourceUrl?: string | null;
  /** The page's own canonical URL if it declared one and it differs. */
  canonicalUrl?: string | null;
  datePublished?: string | null;

  keywords?: string[];
  category?: string | null;
  cuisine?: string | null;

  /** legacy: 'youtube' | 'remix' — kept for the client's existing checks. */
  source?: string;
  extractedVia?: ExtractionMethod;
}

export interface ExtractionOutcome {
  recipe: Recipe | null;
  method: ExtractionMethod;
  /** Number of Recipe candidates seen in structured data (for observability). */
  candidates: number;
}
