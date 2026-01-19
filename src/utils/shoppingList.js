/**
 * Shopping List Utility
 * Handles generation, storage, and management of shopping lists
 */

import {
  parseIngredient,
  getIngredientKey,
  addQuantities,
  formatIngredient,
  normalizeIngredientName,
  areIngredientsSimilar
} from './ingredientParser';
import { getMealsForWeek, getWeekStart, formatDateKey } from './mealPlan';
import { getPantryItems, addPantryItem } from './pantry';

const STORAGE_KEY = 'simpler-recipes-shopping-list';
const EVENT_NAME = 'shopping-list-changed';

// Category display order
export const CATEGORY_ORDER = [
  'produce',
  'meat',
  'seafood',
  'dairy',
  'bakery',
  'pantry',
  'frozen',
  'beverages',
  'other'
];

export const CATEGORY_LABELS = {
  produce: 'Produce',
  meat: 'Meat & Poultry',
  seafood: 'Seafood',
  dairy: 'Dairy & Eggs',
  bakery: 'Bakery',
  pantry: 'Pantry',
  frozen: 'Frozen',
  beverages: 'Beverages',
  other: 'Other'
};

/**
 * Get the stored shopping list
 * @returns {Object} The shopping list data
 */
export function getShoppingList() {
  if (typeof window === 'undefined') {
    return { version: 1, items: [], weekStart: null, generatedAt: null };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading shopping list:', e);
  }

  return { version: 1, items: [], weekStart: null, generatedAt: null };
}

/**
 * Save the shopping list
 * @param {Object} list - The shopping list to save
 */
function saveShoppingList(list) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (e) {
    console.error('Error saving shopping list:', e);
  }
}

/**
 * Generate a shopping list from the current week's meal plan
 * @param {Date} weekStart - The start of the week to generate from
 * @returns {Object} The generated shopping list
 */
export function generateShoppingList(weekStart = null) {
  if (!weekStart) {
    weekStart = getWeekStart(new Date());
  }

  // Get all meals for the week
  const weekMeals = getMealsForWeek(weekStart);

  // Collect all ingredients from all meals
  const allIngredients = [];

  Object.values(weekMeals).forEach(dayMeals => {
    Object.values(dayMeals).forEach(sectionMeals => {
      sectionMeals.forEach(meal => {
        // Get ingredients from the recipe
        let ingredients = [];

        if (meal.extractedRecipe && meal.extractedRecipe.ingredients) {
          // Extracted recipe - ingredients are strings
          ingredients = meal.extractedRecipe.ingredients;
        } else if (meal.recipeSlug) {
          // Curated recipe - we'd need to load the recipe data
          // For now, skip curated recipes (would need to pass recipes array)
          // This will be enhanced when we integrate more deeply
        }

        ingredients.forEach(ing => {
          if (typeof ing === 'string') {
            const parsed = parseIngredient(ing);
            allIngredients.push({
              ...parsed,
              recipeTitle: meal.recipeTitle
            });
          }
        });
      });
    });
  });

  // Merge ingredients by key
  const merged = new Map();

  allIngredients.forEach(ing => {
    const key = getIngredientKey(ing);

    if (merged.has(key)) {
      const existing = merged.get(key);
      existing.quantity = mergeQuantities(existing.quantity, ing.quantity);
      if (!existing.recipes.includes(ing.recipeTitle)) {
        existing.recipes.push(ing.recipeTitle);
      }
    } else {
      merged.set(key, {
        id: generateId(),
        ...ing,
        checked: false,
        inPantry: false,
        recipes: [ing.recipeTitle]
      });
    }
  });

  // Convert to array and check against pantry
  const pantryItems = getPantryItems();
  const pantryNames = new Set(
    pantryItems.map(p => p.name.toLowerCase().trim())
  );

  const items = Array.from(merged.values()).map(item => {
    // Check if item is in pantry (simple name match for Phase 1)
    const nameWords = item.name.toLowerCase().split(' ');
    const inPantry = nameWords.some(word =>
      pantryItems.some(p => p.name.toLowerCase().includes(word))
    );

    return {
      ...item,
      inPantry,
      checked: inPantry // Pre-check items that are in pantry
    };
  });

  // Sort by category
  items.sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.name.localeCompare(b.name);
  });

  const list = {
    version: 1,
    items,
    weekStart: formatDateKey(weekStart),
    generatedAt: Date.now()
  };

  saveShoppingList(list);
  return list;
}

/**
 * Generate shopping list with curated recipes data
 * @param {Date} weekStart - The start of the week
 * @param {Object[]} recipes - Array of curated recipes with full data
 * @returns {Object} The generated shopping list
 */
export function generateShoppingListWithRecipes(weekStart = null, recipes = []) {
  if (!weekStart) {
    weekStart = getWeekStart(new Date());
  }

  // Build a map of recipes by slug for quick lookup
  const recipeMap = new Map();
  recipes.forEach(r => {
    if (r.slug) {
      recipeMap.set(r.slug, r);
    }
  });

  // Get all meals for the week
  const weekMeals = getMealsForWeek(weekStart);

  // Collect all ingredients from all meals
  const allIngredients = [];

  Object.values(weekMeals).forEach(dayMeals => {
    Object.values(dayMeals).forEach(sectionMeals => {
      sectionMeals.forEach(meal => {
        let ingredients = [];

        if (meal.extractedRecipe && meal.extractedRecipe.ingredients) {
          // Extracted recipe - ingredients are strings
          ingredients = meal.extractedRecipe.ingredients;
        } else if (meal.recipeSlug && recipeMap.has(meal.recipeSlug)) {
          // Curated recipe - get ingredients from recipe data
          const recipe = recipeMap.get(meal.recipeSlug);
          if (recipe.ingredients) {
            ingredients = recipe.ingredients;
          }
        }

        ingredients.forEach(ing => {
          if (typeof ing === 'string') {
            const parsed = parseIngredient(ing);
            allIngredients.push({
              ...parsed,
              recipeTitle: meal.recipeTitle
            });
          }
        });
      });
    });
  });

  // Merge ingredients by key with smart quantity addition
  const merged = new Map();

  allIngredients.forEach(ing => {
    const key = getIngredientKey(ing);

    if (merged.has(key)) {
      const existing = merged.get(key);
      // Use smart quantity addition with unit conversion
      const result = addQuantities(existing.quantity, existing.unit, ing.quantity, ing.unit);
      existing.quantity = result.quantity;
      existing.unit = result.unit;
      if (!existing.recipes.includes(ing.recipeTitle)) {
        existing.recipes.push(ing.recipeTitle);
      }
    } else {
      merged.set(key, {
        id: generateId(),
        ...ing,
        // Use canonical name for display
        displayName: normalizeIngredientName(ing.name) || ing.name,
        checked: false,
        inPantry: false,
        pantryItemId: null,
        recipes: [ing.recipeTitle]
      });
    }
  });

  // Convert to array and check against pantry with smart matching
  const pantryItems = getPantryItems();

  const items = Array.from(merged.values()).map(item => {
    // Find matching pantry item using fuzzy matching
    const matchingPantryItem = pantryItems.find(p =>
      areIngredientsSimilar(item.name, p.name) ||
      areIngredientsSimilar(item.displayName, p.name)
    );

    const inPantry = !!matchingPantryItem;

    return {
      ...item,
      inPantry,
      pantryItemId: matchingPantryItem?.id || null,
      checked: inPantry // Pre-check items that are in pantry
    };
  });

  // Sort by category
  items.sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.name.localeCompare(b.name);
  });

  const list = {
    version: 1,
    items,
    weekStart: formatDateKey(weekStart),
    generatedAt: Date.now()
  };

  saveShoppingList(list);
  return list;
}

/**
 * Toggle an item's checked state
 * @param {string} itemId - The item ID to toggle
 */
export function toggleItem(itemId) {
  const list = getShoppingList();
  const item = list.items.find(i => i.id === itemId);

  if (item) {
    item.checked = !item.checked;
    saveShoppingList(list);
  }
}

/**
 * Remove an item from the shopping list
 * @param {string} itemId - The item ID to remove
 */
export function removeItem(itemId) {
  const list = getShoppingList();
  list.items = list.items.filter(i => i.id !== itemId);
  saveShoppingList(list);
}

/**
 * Add a custom item to the shopping list
 * @param {string} ingredientStr - The ingredient string to add
 */
export function addCustomItem(ingredientStr) {
  const list = getShoppingList();
  const parsed = parseIngredient(ingredientStr);

  list.items.push({
    id: generateId(),
    ...parsed,
    checked: false,
    inPantry: false,
    recipes: ['Added manually'],
    isCustom: true
  });

  // Re-sort
  list.items.sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.name.localeCompare(b.name);
  });

  saveShoppingList(list);
}

/**
 * Clear all checked items from the shopping list
 */
export function clearCheckedItems() {
  const list = getShoppingList();
  list.items = list.items.filter(i => !i.checked);
  saveShoppingList(list);
}

/**
 * Clear the entire shopping list
 */
export function clearShoppingList() {
  saveShoppingList({ version: 1, items: [], weekStart: null, generatedAt: null });
}

/**
 * Get items grouped by category
 * @returns {Object} Items grouped by category
 */
export function getItemsByCategory() {
  const list = getShoppingList();
  const grouped = {};

  CATEGORY_ORDER.forEach(cat => {
    grouped[cat] = [];
  });

  list.items.forEach(item => {
    const cat = item.category || 'other';
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push(item);
  });

  return grouped;
}

/**
 * Get shopping list stats
 * @returns {Object} Stats about the shopping list
 */
export function getListStats() {
  const list = getShoppingList();
  const total = list.items.length;
  const checked = list.items.filter(i => i.checked).length;
  const unchecked = total - checked;

  return {
    total,
    checked,
    unchecked,
    percentComplete: total > 0 ? Math.round((checked / total) * 100) : 0
  };
}

/**
 * Generate a unique ID
 * @returns {string}
 */
function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * Get the event name for shopping list changes
 * @returns {string}
 */
export function getEventName() {
  return EVENT_NAME;
}

/**
 * Add checked items to pantry and remove them from the list
 * @returns {number} Number of items added to pantry
 */
export function addCheckedToPantry() {
  const list = getShoppingList();
  const checkedItems = list.items.filter(i => i.checked && !i.inPantry);

  let addedCount = 0;

  checkedItems.forEach(item => {
    // Add to pantry using the display name or original name
    const name = item.displayName || item.name;
    if (name && name.trim()) {
      addPantryItem(name.trim());
      addedCount++;
    }
  });

  // Remove checked items from the list
  list.items = list.items.filter(i => !i.checked);
  saveShoppingList(list);

  return addedCount;
}

/**
 * Add a single item to pantry
 * @param {string} itemId - The item ID to add to pantry
 */
export function addItemToPantry(itemId) {
  const list = getShoppingList();
  const item = list.items.find(i => i.id === itemId);

  if (item) {
    const name = item.displayName || item.name;
    if (name && name.trim()) {
      addPantryItem(name.trim());
      // Mark as in pantry
      item.inPantry = true;
    }
    saveShoppingList(list);
  }
}

/**
 * Update an item's quantity
 * @param {string} itemId - The item ID
 * @param {number} quantity - The new quantity
 */
export function updateItemQuantity(itemId, quantity) {
  const list = getShoppingList();
  const item = list.items.find(i => i.id === itemId);

  if (item) {
    item.quantity = quantity;
    saveShoppingList(list);
  }
}

/**
 * Get a shareable text version of the shopping list
 * @returns {string} Formatted shopping list text
 */
export function getShareableList() {
  const list = getShoppingList();
  const lines = [];

  let currentCategory = null;

  // Only include unchecked items
  const uncheckedItems = list.items.filter(i => !i.checked);

  uncheckedItems.forEach(item => {
    if (item.category !== currentCategory) {
      if (currentCategory !== null) {
        lines.push(''); // Add blank line between categories
      }
      currentCategory = item.category;
      lines.push(`## ${CATEGORY_LABELS[item.category] || item.category}`);
    }

    const displayText = formatIngredient(item);
    lines.push(`- [ ] ${displayText}`);
  });

  if (lines.length === 0) {
    return 'Shopping list is empty!';
  }

  return `# Shopping List\n\n${lines.join('\n')}`;
}
