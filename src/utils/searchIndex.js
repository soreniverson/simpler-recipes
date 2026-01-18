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
  threshold: 0.4,
  // Distance: how far to search for a fuzzy match
  distance: 100,
  // Use extended search for better matching
  useExtendedSearch: false,
  // Ignore location - match anywhere in the field
  ignoreLocation: true,
  // Fields to search with weights
  keys: [
    { name: 'title', weight: 1.0 },
    { name: 'tags', weight: 0.7 },
    { name: 'ingredients', weight: 0.5 },
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
export function searchRecipes(fuse, query, limit = 20) {
  if (!query || query.trim().length < 2) {
    return [];
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
