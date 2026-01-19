/**
 * Pantry utility for managing ingredients the user has on hand
 * Uses localStorage with custom events for reactive updates
 *
 * Sync: Changes are automatically pushed to Supabase when user is authenticated
 */

import { pushToRemote } from './sync.js';

const STORAGE_KEY = 'simpler-recipes-pantry';
const CURRENT_VERSION = 1;

/**
 * Generate a unique ID for pantry items
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Normalize ingredient name for consistent storage and matching
 * @param {string} name - Ingredient name
 * @returns {string} Normalized name
 */
export function normalizeIngredient(name) {
  return name.toLowerCase().trim();
}

/**
 * Get the pantry data from localStorage
 * @returns {{ items: Array, version: number }}
 */
function getPantryData() {
  if (typeof window === 'undefined') {
    return { items: [], version: CURRENT_VERSION };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { items: [], version: CURRENT_VERSION };
    }
    const data = JSON.parse(stored);
    // Handle future migrations if needed
    if (!data.version) {
      data.version = CURRENT_VERSION;
    }
    return data;
  } catch {
    return { items: [], version: CURRENT_VERSION };
  }
}

/**
 * Save pantry data to localStorage and dispatch event
 * Also triggers remote sync if user is authenticated
 * @param {{ items: Array, version: number }} data
 */
function savePantryData(data) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('pantry-changed', {
    detail: { items: data.items }
  }));

  // Sync to remote (fire-and-forget, don't block UI)
  pushToRemote('pantry').catch(() => {
    // Silently fail - offline or not authenticated
  });
}

/**
 * Get all pantry items
 * @returns {Array<{ id: string, name: string, addedAt: number }>}
 */
export function getPantryItems() {
  return getPantryData().items;
}

/**
 * Check if a pantry item exists by name
 * @param {string} name - Ingredient name
 * @returns {boolean}
 */
export function hasPantryItem(name) {
  const normalized = normalizeIngredient(name);
  return getPantryItems().some(item => item.name === normalized);
}

/**
 * Add an ingredient to the pantry
 * @param {string} name - Ingredient name
 * @returns {string|null} The generated ID, or null if already exists
 */
export function addPantryItem(name) {
  if (typeof window === 'undefined') return null;

  const normalized = normalizeIngredient(name);
  if (!normalized) return null;

  const data = getPantryData();

  // Don't add duplicates
  if (data.items.some(item => item.name === normalized)) {
    return null;
  }

  const id = generateId();
  data.items.push({
    id,
    name: normalized,
    addedAt: Date.now()
  });

  savePantryData(data);
  return id;
}

/**
 * Add multiple ingredients to the pantry
 * @param {string[]} names - Array of ingredient names
 * @returns {number} Number of items actually added
 */
export function addPantryItems(names) {
  if (typeof window === 'undefined') return 0;

  const data = getPantryData();
  const existingNames = new Set(data.items.map(item => item.name));
  let addedCount = 0;

  for (const name of names) {
    const normalized = normalizeIngredient(name);
    if (normalized && !existingNames.has(normalized)) {
      data.items.push({
        id: generateId(),
        name: normalized,
        addedAt: Date.now()
      });
      existingNames.add(normalized);
      addedCount++;
    }
  }

  if (addedCount > 0) {
    savePantryData(data);
  }

  return addedCount;
}

/**
 * Remove an ingredient from the pantry by ID
 * @param {string} id - Item ID
 */
export function removePantryItem(id) {
  if (typeof window === 'undefined') return;

  const data = getPantryData();
  data.items = data.items.filter(item => item.id !== id);
  savePantryData(data);
}

/**
 * Remove an ingredient from the pantry by name
 * @param {string} name - Ingredient name
 */
export function removePantryItemByName(name) {
  if (typeof window === 'undefined') return;

  const normalized = normalizeIngredient(name);
  const data = getPantryData();
  data.items = data.items.filter(item => item.name !== normalized);
  savePantryData(data);
}

/**
 * Get the count of pantry items
 * @returns {number}
 */
export function getPantryCount() {
  return getPantryItems().length;
}

/**
 * Clear all pantry items
 */
export function clearPantry() {
  if (typeof window === 'undefined') return;

  savePantryData({ items: [], version: CURRENT_VERSION });
}

/**
 * Check if this is the first time using the pantry (for onboarding)
 * @returns {boolean}
 */
export function isFirstPantryUse() {
  if (typeof window === 'undefined') return false;

  return localStorage.getItem(STORAGE_KEY) === null;
}

/**
 * Mark that the user has seen the onboarding
 */
export function markPantryOnboardingSeen() {
  if (typeof window === 'undefined') return;

  // If pantry is empty, save empty state to mark as "seen"
  const data = getPantryData();
  if (data.items.length === 0) {
    savePantryData(data);
  }
}

/**
 * Common kitchen staples for quick-add onboarding
 */
export const COMMON_STAPLES = [
  'salt',
  'black pepper',
  'olive oil',
  'vegetable oil',
  'butter',
  'garlic',
  'onion',
  'eggs',
  'milk',
  'flour',
  'sugar',
  'chicken broth',
  'soy sauce',
  'rice',
  'pasta',
];
