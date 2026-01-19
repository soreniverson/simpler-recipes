/**
 * Favorites utility for managing saved recipes in localStorage
 * Supports two types of favorites:
 * - Curated recipes: { type: 'curated', slug: string, folderId?: string }
 * - Extracted recipes: { type: 'extracted', id: string, recipe: object, sourceUrl: string, folderId?: string }
 *
 * Data structure:
 * {
 *   version: 2,
 *   folders: [{ id, name, createdAt }],
 *   items: [favorite objects]
 * }
 */

const STORAGE_KEY = 'simpler-recipes-favorites';
const CURRENT_VERSION = 2;

/**
 * Generate a unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Migrate from old formats to current version
 */
function migrate(data) {
  // Handle null/undefined
  if (!data) {
    return { version: CURRENT_VERSION, folders: [], items: [] };
  }

  // Version 1: Array of strings (slugs only)
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
    return {
      version: CURRENT_VERSION,
      folders: [],
      items: data.map(slug => ({ type: 'curated', slug }))
    };
  }

  // Version 1.5: Array of objects with type
  if (Array.isArray(data)) {
    return {
      version: CURRENT_VERSION,
      folders: [],
      items: data.map(item => {
        if (typeof item === 'string') {
          return { type: 'curated', slug: item };
        }
        return item;
      })
    };
  }

  // Version 2: Object with folders and items
  if (data.version === CURRENT_VERSION) {
    return data;
  }

  // Unknown format, start fresh
  return { version: CURRENT_VERSION, folders: [], items: [] };
}

/**
 * Get the full favorites data structure
 */
function getData() {
  if (typeof window === 'undefined') {
    return { version: CURRENT_VERSION, folders: [], items: [] };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { version: CURRENT_VERSION, folders: [], items: [] };
    }
    const data = JSON.parse(stored);
    const migrated = migrate(data);

    // Save migrated data back if version changed
    if (data.version !== CURRENT_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }

    return migrated;
  } catch {
    return { version: CURRENT_VERSION, folders: [], items: [] };
  }
}

/**
 * Save data and dispatch change event
 */
function saveData(data) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('favorites-changed', { detail: data }));
}

// ============ FOLDER FUNCTIONS ============

/**
 * Get all folders
 * @returns {Array} Array of folder objects { id, name, createdAt }
 */
export function getFolders() {
  return getData().folders;
}

/**
 * Create a new folder
 * @param {string} name - Folder name
 * @returns {string} The new folder's ID
 */
export function createFolder(name) {
  const data = getData();
  const id = generateId();
  data.folders.push({ id, name: name.trim(), createdAt: Date.now() });
  saveData(data);
  return id;
}

/**
 * Rename a folder
 * @param {string} folderId - Folder ID
 * @param {string} newName - New folder name
 */
export function renameFolder(folderId, newName) {
  const data = getData();
  const folder = data.folders.find(f => f.id === folderId);
  if (folder) {
    folder.name = newName.trim();
    saveData(data);
  }
}

/**
 * Delete a folder (moves items to unfiled)
 * @param {string} folderId - Folder ID
 */
export function deleteFolder(folderId) {
  const data = getData();
  data.folders = data.folders.filter(f => f.id !== folderId);
  // Move items from deleted folder to unfiled
  data.items.forEach(item => {
    if (item.folderId === folderId) {
      delete item.folderId;
    }
  });
  saveData(data);
}

// ============ FAVORITE ITEM FUNCTIONS ============

/**
 * Get all favorites (items only)
 * @returns {Array} Array of favorite objects
 */
export function getFavorites() {
  return getData().items;
}

/**
 * Get favorites in a specific folder
 * @param {string|null} folderId - Folder ID or null for unfiled
 * @returns {Array} Array of favorite objects
 */
export function getFavoritesInFolder(folderId) {
  return getData().items.filter(item =>
    folderId ? item.folderId === folderId : !item.folderId
  );
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
 * @param {string|null} folderId - Optional folder ID
 */
export function addFavorite(slug, folderId = null) {
  const data = getData();
  if (!data.items.some(f => f.type === 'curated' && f.slug === slug)) {
    const item = { type: 'curated', slug };
    if (folderId) item.folderId = folderId;
    data.items.push(item);
    saveData(data);
  }
}

/**
 * Add an extracted recipe to favorites
 * @param {object} recipe - Full recipe object
 * @param {string} sourceUrl - Original URL
 * @param {string|null} folderId - Optional folder ID
 * @returns {string} The generated ID for the saved recipe
 */
export function addExtractedFavorite(recipe, sourceUrl, folderId = null) {
  const data = getData();
  const id = generateId();
  const item = { type: 'extracted', id, recipe, sourceUrl };
  if (folderId) item.folderId = folderId;
  data.items.push(item);
  saveData(data);
  return id;
}

/**
 * Remove a curated recipe from favorites
 * @param {string} slug - Recipe slug
 */
export function removeFavorite(slug) {
  const data = getData();
  data.items = data.items.filter(f => !(f.type === 'curated' && f.slug === slug));
  saveData(data);
}

/**
 * Remove an extracted recipe from favorites
 * @param {string} id - Extracted recipe ID
 */
export function removeExtractedFavorite(id) {
  const data = getData();
  data.items = data.items.filter(f => !(f.type === 'extracted' && f.id === id));
  saveData(data);
}

/**
 * Move a favorite to a different folder
 * @param {string} itemId - For extracted: the id. For curated: the slug
 * @param {string} type - 'curated' or 'extracted'
 * @param {string|null} folderId - Target folder ID or null for unfiled
 */
export function moveFavorite(itemId, type, folderId) {
  const data = getData();
  const item = data.items.find(f =>
    type === 'curated' ? (f.type === 'curated' && f.slug === itemId)
                       : (f.type === 'extracted' && f.id === itemId)
  );
  if (item) {
    if (folderId) {
      item.folderId = folderId;
    } else {
      delete item.folderId;
    }
    saveData(data);
  }
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
  saveData({ version: CURRENT_VERSION, folders: [], items: [] });
}

/**
 * Get folder by ID
 * @param {string} folderId - Folder ID
 * @returns {object|null} Folder object or null
 */
export function getFolder(folderId) {
  return getData().folders.find(f => f.id === folderId) || null;
}

/**
 * Get count of items in a folder
 * @param {string|null} folderId - Folder ID or null for unfiled
 * @returns {number}
 */
export function getFolderCount(folderId) {
  return getFavoritesInFolder(folderId).length;
}
