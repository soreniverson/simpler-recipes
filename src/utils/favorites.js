/**
 * Favorites utility for managing saved recipes in localStorage
 * Supports two types:
 * - Curated recipes: { type: 'curated', slug: string }
 * - Extracted recipes: { type: 'extracted', id: string, recipe: object, sourceUrl: string }
 */

const STORAGE_KEY = 'simpler-recipes-favorites';

/**
 * Generate a unique ID for extracted recipes
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Migrate old format (array of strings) to new format
 */
function migrateIfNeeded(data) {
  if (!Array.isArray(data) || data.length === 0) return data;

  // Check if already in new format (first item is an object with 'type')
  if (typeof data[0] === 'object' && data[0].type) {
    return data;
  }

  // Migrate old format (array of slugs) to new format
  return data.map(slug => ({ type: 'curated', slug }));
}

/**
 * Get all favorites from localStorage
 * @returns {Array} Array of favorite objects
 */
export function getFavorites() {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const data = JSON.parse(stored);
    const migrated = migrateIfNeeded(data);

    // Save migrated data back if it changed
    if (migrated !== data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }

    return migrated;
  } catch {
    return [];
  }
}

/**
 * Get only curated recipe slugs
 * @returns {string[]} Array of recipe slugs
 */
export function getCuratedFavorites() {
  return getFavorites()
    .filter(f => f.type === 'curated')
    .map(f => f.slug);
}

/**
 * Get only extracted recipes
 * @returns {Array} Array of extracted recipe objects
 */
export function getExtractedFavorites() {
  return getFavorites().filter(f => f.type === 'extracted');
}

/**
 * Check if a curated recipe is favorited
 * @param {string} slug - Recipe slug
 * @returns {boolean}
 */
export function isFavorite(slug) {
  return getFavorites().some(f => f.type === 'curated' && f.slug === slug);
}

/**
 * Check if an extracted recipe is favorited by its ID
 * @param {string} id - Extracted recipe ID
 * @returns {boolean}
 */
export function isExtractedFavorite(id) {
  return getFavorites().some(f => f.type === 'extracted' && f.id === id);
}

/**
 * Add a curated recipe to favorites
 * @param {string} slug - Recipe slug
 */
export function addFavorite(slug) {
  if (typeof window === 'undefined') return;

  const favorites = getFavorites();
  if (!favorites.some(f => f.type === 'curated' && f.slug === slug)) {
    favorites.push({ type: 'curated', slug });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { favorites } }));
  }
}

/**
 * Add an extracted recipe to favorites
 * @param {object} recipe - Full recipe object
 * @param {string} sourceUrl - Original URL
 * @returns {string} The generated ID for the saved recipe
 */
export function addExtractedFavorite(recipe, sourceUrl) {
  if (typeof window === 'undefined') return null;

  const favorites = getFavorites();
  const id = generateId();
  favorites.push({ type: 'extracted', id, recipe, sourceUrl });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { favorites } }));
  return id;
}

/**
 * Remove a curated recipe from favorites
 * @param {string} slug - Recipe slug
 */
export function removeFavorite(slug) {
  if (typeof window === 'undefined') return;

  const favorites = getFavorites().filter(f => !(f.type === 'curated' && f.slug === slug));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { favorites } }));
}

/**
 * Remove an extracted recipe from favorites
 * @param {string} id - Extracted recipe ID
 */
export function removeExtractedFavorite(id) {
  if (typeof window === 'undefined') return;

  const favorites = getFavorites().filter(f => !(f.type === 'extracted' && f.id === id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { favorites } }));
}

/**
 * Toggle a curated recipe's favorite status
 * @param {string} slug - Recipe slug
 * @returns {boolean} New favorite status
 */
export function toggleFavorite(slug) {
  if (isFavorite(slug)) {
    removeFavorite(slug);
    return false;
  } else {
    addFavorite(slug);
    return true;
  }
}

/**
 * Toggle an extracted recipe's favorite status
 * @param {string} id - Extracted recipe ID
 * @param {object} recipe - Full recipe object (needed if adding)
 * @param {string} sourceUrl - Original URL (needed if adding)
 * @returns {boolean|string} False if removed, or the ID if added
 */
export function toggleExtractedFavorite(id, recipe, sourceUrl) {
  if (isExtractedFavorite(id)) {
    removeExtractedFavorite(id);
    return false;
  } else {
    return addExtractedFavorite(recipe, sourceUrl);
  }
}

/**
 * Get the count of all favorites
 * @returns {number}
 */
export function getFavoritesCount() {
  return getFavorites().length;
}

/**
 * Clear all favorites
 */
export function clearFavorites() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { favorites: [] } }));
}
