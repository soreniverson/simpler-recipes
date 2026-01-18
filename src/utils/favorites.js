/**
 * Favorites utility for managing saved recipes in localStorage
 */

const STORAGE_KEY = 'simpler-recipes-favorites';

/**
 * Get all favorite recipe slugs from localStorage
 * @returns {string[]} Array of recipe slugs
 */
export function getFavorites() {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Check if a recipe is favorited
 * @param {string} slug - Recipe slug
 * @returns {boolean}
 */
export function isFavorite(slug) {
  return getFavorites().includes(slug);
}

/**
 * Add a recipe to favorites
 * @param {string} slug - Recipe slug
 */
export function addFavorite(slug) {
  if (typeof window === 'undefined') return;

  const favorites = getFavorites();
  if (!favorites.includes(slug)) {
    favorites.push(slug);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { favorites } }));
  }
}

/**
 * Remove a recipe from favorites
 * @param {string} slug - Recipe slug
 */
export function removeFavorite(slug) {
  if (typeof window === 'undefined') return;

  const favorites = getFavorites().filter(s => s !== slug);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { favorites } }));
}

/**
 * Toggle a recipe's favorite status
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
 * Get the count of favorites
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
