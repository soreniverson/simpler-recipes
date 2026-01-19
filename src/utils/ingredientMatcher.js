/**
 * Ingredient extraction and matching utilities
 * Extracts core ingredients from recipe strings and matches against pantry items
 */

import { normalizeIngredient } from './pantry.js';

// Common measurement units to remove
const UNITS = [
  // Volume
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'litre', 'litres',
  'fl oz', 'fluid ounce', 'fluid ounces', 'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons',
  // Weight
  'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
  // Count
  'piece', 'pieces', 'slice', 'slices', 'clove', 'cloves',
  'sprig', 'sprigs', 'bunch', 'bunches', 'head', 'heads',
  'can', 'cans', 'jar', 'jars', 'packet', 'packets', 'package', 'packages',
  'handful', 'handfuls', 'pinch', 'pinches', 'dash', 'dashes',
  // Size
  'small', 'medium', 'large', 'extra large',
];

// Preparation words to remove
const PREP_WORDS = [
  'chopped', 'diced', 'minced', 'sliced', 'cubed', 'crushed', 'grated',
  'shredded', 'julienned', 'peeled', 'deveined', 'seeded', 'cored',
  'halved', 'quartered', 'trimmed', 'cleaned', 'washed', 'drained',
  'rinsed', 'dried', 'toasted', 'roasted', 'melted', 'softened',
  'room temperature', 'cold', 'warm', 'hot', 'frozen', 'thawed', 'defrosted',
  'fresh', 'dried', 'ground', 'whole', 'raw', 'cooked', 'uncooked',
  'boneless', 'skinless', 'bone-in', 'skin-on',
  'finely', 'roughly', 'coarsely', 'thinly', 'thickly',
  'optional', 'to taste', 'as needed', 'for garnish', 'for serving',
  'packed', 'loosely packed', 'firmly packed', 'heaping', 'level',
];

// Words that indicate alternatives (split on these)
const ALTERNATIVE_INDICATORS = ['or', 'alternatively', 'substitute'];

/**
 * Extract the core ingredient name from a recipe ingredient string
 * @param {string} ingredientString - Full ingredient string like "2 tbsp olive oil (extra virgin)"
 * @returns {string} Extracted core ingredient like "olive oil"
 */
export function extractIngredientName(ingredientString) {
  if (!ingredientString) return '';

  let text = ingredientString.toLowerCase();

  // Remove content in parentheses (often contains notes, alternatives)
  text = text.replace(/\([^)]*\)/g, ' ');

  // Remove content after common separators for notes
  text = text.replace(/\s*[-–—]\s*(?:note|see|about|approximately).*/i, '');

  // Remove fractions (both unicode and ASCII)
  text = text.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, ' ');

  // Remove numeric quantities (including decimals and fractions)
  text = text.replace(/\b\d+(?:\.\d+)?(?:\s*\/\s*\d+)?\s*/g, ' ');
  text = text.replace(/\b\d+\s*-\s*\d+\b/g, ' '); // ranges like "1-2"

  // Remove units (with word boundaries)
  const unitPattern = new RegExp(`\\b(${UNITS.join('|')})\\b`, 'gi');
  text = text.replace(unitPattern, ' ');

  // Remove prep words
  const prepPattern = new RegExp(`\\b(${PREP_WORDS.join('|')})\\b`, 'gi');
  text = text.replace(prepPattern, ' ');

  // Remove punctuation except hyphens within words
  text = text.replace(/[,;:'"!?*]/g, ' ');
  text = text.replace(/\s+/g, ' ');

  // Trim and clean up
  text = text.trim();

  // If we have alternatives (e.g., "butter or margarine"), take the first one
  for (const indicator of ALTERNATIVE_INDICATORS) {
    const parts = text.split(new RegExp(`\\s+${indicator}\\s+`, 'i'));
    if (parts.length > 1) {
      text = parts[0].trim();
      break;
    }
  }

  return text;
}

/**
 * Check if a pantry item matches a recipe ingredient
 * Uses substring matching with some fuzzy tolerance
 * @param {string} pantryItem - Normalized pantry item name
 * @param {string} recipeIngredient - Full recipe ingredient string
 * @returns {boolean} Whether there's a match
 */
export function ingredientMatches(pantryItem, recipeIngredient) {
  const extracted = extractIngredientName(recipeIngredient);
  const normalizedPantry = normalizeIngredient(pantryItem);

  if (!extracted || !normalizedPantry) return false;

  // Exact match
  if (extracted === normalizedPantry) return true;

  // Pantry item is a substring of extracted (e.g., "garlic" matches "garlic cloves")
  if (extracted.includes(normalizedPantry)) return true;

  // Extracted is a substring of pantry item (e.g., "chicken" matches "chicken breast")
  if (normalizedPantry.includes(extracted)) return true;

  // Word-level matching for compound ingredients
  const pantryWords = normalizedPantry.split(/\s+/);
  const extractedWords = extracted.split(/\s+/);

  // If the main ingredient word matches (first word often most important)
  if (pantryWords[0] === extractedWords[0] && pantryWords[0].length > 3) {
    return true;
  }

  // Check if all pantry words appear in extracted (for "chicken breast" matching "chicken")
  if (pantryWords.length > 1) {
    const allWordsMatch = pantryWords.every(word =>
      extractedWords.some(ew => ew.includes(word) || word.includes(ew))
    );
    if (allWordsMatch) return true;
  }

  return false;
}

/**
 * Calculate how many pantry items match a recipe's ingredients
 * @param {string[]} pantryItems - Array of normalized pantry item names
 * @param {string[]} recipeIngredients - Array of recipe ingredient strings
 * @returns {{ matched: number, total: number, matchedIngredients: string[], missingIngredients: string[] }}
 */
export function calculateRecipeMatch(pantryItems, recipeIngredients) {
  if (!recipeIngredients || recipeIngredients.length === 0) {
    return { matched: 0, total: 0, matchedIngredients: [], missingIngredients: [] };
  }

  const pantrySet = new Set(pantryItems.map(normalizeIngredient));
  const matchedIngredients = [];
  const missingIngredients = [];

  for (const ingredient of recipeIngredients) {
    let isMatched = false;

    for (const pantryItem of pantrySet) {
      if (ingredientMatches(pantryItem, ingredient)) {
        isMatched = true;
        break;
      }
    }

    if (isMatched) {
      matchedIngredients.push(ingredient);
    } else {
      missingIngredients.push(ingredient);
    }
  }

  return {
    matched: matchedIngredients.length,
    total: recipeIngredients.length,
    matchedIngredients,
    missingIngredients
  };
}

/**
 * Calculate match percentage for sorting
 * @param {string[]} pantryItems - Array of normalized pantry item names
 * @param {string[]} recipeIngredients - Array of recipe ingredient strings
 * @returns {number} Match percentage (0-100)
 */
export function getMatchPercentage(pantryItems, recipeIngredients) {
  const { matched, total } = calculateRecipeMatch(pantryItems, recipeIngredients);
  if (total === 0) return 0;
  return Math.round((matched / total) * 100);
}

/**
 * Sort recipes by match percentage (highest first)
 * @param {Array} recipes - Array of recipe objects with ingredients
 * @param {string[]} pantryItems - Array of normalized pantry item names
 * @returns {Array} Sorted recipes with match info attached
 */
export function sortRecipesByMatch(recipes, pantryItems) {
  if (!pantryItems || pantryItems.length === 0) {
    return recipes.map(recipe => ({
      ...recipe,
      matchInfo: { matched: 0, total: recipe.ingredients?.length || 0, percentage: 0 }
    }));
  }

  return recipes
    .map(recipe => {
      const { matched, total } = calculateRecipeMatch(pantryItems, recipe.ingredients || []);
      const percentage = total > 0 ? Math.round((matched / total) * 100) : 0;
      return {
        ...recipe,
        matchInfo: { matched, total, percentage }
      };
    })
    .sort((a, b) => {
      // Sort by percentage first, then by absolute matches
      if (b.matchInfo.percentage !== a.matchInfo.percentage) {
        return b.matchInfo.percentage - a.matchInfo.percentage;
      }
      return b.matchInfo.matched - a.matchInfo.matched;
    });
}

/**
 * Check if a specific recipe ingredient is matched by pantry items
 * @param {string} ingredient - Recipe ingredient string
 * @param {string[]} pantryItems - Array of normalized pantry item names
 * @returns {boolean}
 */
export function isIngredientMatched(ingredient, pantryItems) {
  for (const pantryItem of pantryItems) {
    if (ingredientMatches(pantryItem, ingredient)) {
      return true;
    }
  }
  return false;
}
