import Fuse from 'fuse.js';

/**
 * Fuse.js configuration for recipe search
 *
 * Weights determine how much each field contributes to the match score:
 * - title: 1.0 (highest priority - exact recipe names)
 * - tags: 0.7 (categories like "vegetarian", "quick")
 * - ingredients: 0.5 (find recipes by what you have)
 */
export const fuseOptions = {
  // Include score for ranking results
  includeScore: true,
  // Include which keys matched for highlighting
  includeMatches: true,
  // Minimum characters before search starts
  minMatchCharLength: 2,
  // Threshold: 0 = exact match, 1 = match anything
  // 0.4 allows for typos while staying relevant
  threshold: 0.34,
  // Distance: how far to search for a fuzzy match
  distance: 100,
  // Use extended search for better matching
  useExtendedSearch: false,
  // Ignore location - match anywhere in the field
  ignoreLocation: true,
  // Fields to search with weights
  keys: [
    { name: 'title', weight: 1.0 },
    { name: 'tags', weight: 0.5 },
    { name: 'ingredients', weight: 0.3 },
  ],
};

/**
 * Create a Fuse search index from recipes
 * @param {Array} recipes - Array of recipe objects
 * @returns {Fuse} Configured Fuse instance
 */
export function createSearchIndex(recipes) {
  return new Fuse(recipes, fuseOptions);
}

/**
 * Search recipes with fuzzy matching
 * @param {Fuse} fuse - Fuse instance
 * @param {string} query - Search query
 * @param {number} limit - Max results to return
 * @returns {Array} Search results with metadata
 */
/** "30 min", "under 20 minutes", "quick 15 min dinner" → minutes, and the query with that part removed. */
export function parseDurationQuery(query) {
  const m = query.match(/\b(?:under|less than|in|within)?\s*(\d{1,3})\s*(?:-|–)?\s*(min|mins|minute|minutes|hr|hrs|hour|hours)\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const minutes = /^h/i.test(m[2]) ? n * 60 : n;
  const rest = query.replace(m[0], ' ').replace(/\b(quick|fast|easy|recipes?|dinners?|meals?)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return { minutes, rest };
}

function totalMinutesOf(recipe) {
  const t = recipe.totalTime;
  if (!t) return null;
  if (typeof t === 'number') return t;
  const h = t.match(/(\d+)\s*h/i);
  const m = t.match(/(\d+)\s*m/i);
  if (!h && !m) return null;
  return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
}

export function searchRecipes(fuse, query, limit = 20) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  // Time-bounded queries: "30 min" means "recipes done in 30 minutes", not fuzzy matches on "min".
  const dq = parseDurationQuery(query.trim());
  if (dq) {
    const docs = fuse.getIndex().docs || fuse._docs || [];
    let pool = docs.filter((r) => {
      const tm = totalMinutesOf(r);
      return tm != null && tm <= dq.minutes;
    });
    if (dq.rest.length >= 2) {
      const sub = new Fuse(pool, fuseOptions).search(dq.rest, { limit: limit * 2 });
      pool = sub.map((r) => r.item);
    } else {
      pool = pool.sort((a, b) => (totalMinutesOf(a) ?? 0) - (totalMinutesOf(b) ?? 0));
    }
    return pool.slice(0, limit).map((recipe) => ({ recipe, score: 0, matches: [{ field: 'totalTime', value: recipe.totalTime, indices: [] }] }));
  }

  const results = fuse.search(query.trim(), { limit });

  return results.map((result) => ({
    recipe: result.item,
    score: result.score,
    matches: result.matches?.map((match) => ({
      field: match.key,
      value: match.value,
      indices: match.indices,
    })),
  }));
}

/**
 * Get the primary match field for display
 * @param {Array} matches - Match data from Fuse
 * @returns {string|null} The most relevant matched field
 */
export function getPrimaryMatch(matches) {
  if (!matches || matches.length === 0) return null;

  // Priority order: title > tags > ingredients
  const priority = ['title', 'tags', 'ingredients'];

  for (const field of priority) {
    const match = matches.find((m) => m.field === field);
    if (match) return field;
  }

  return matches[0]?.field || null;
}
