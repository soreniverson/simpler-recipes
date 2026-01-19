#!/usr/bin/env node
/**
 * Build-time script to extract ingredient suggestions from all recipes
 * Creates a deduplicated list of core ingredient names for autocomplete
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RECIPE_DATA_PATH = path.join(__dirname, '../recipe-data/all-recipes.json');
const OUTPUT_PATH = path.join(__dirname, '../public/pantry-suggestions.json');

// Common measurement units to remove
const UNITS = [
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'litre', 'litres',
  'fl oz', 'fluid ounce', 'fluid ounces', 'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons',
  'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
  'piece', 'pieces', 'slice', 'slices', 'clove', 'cloves',
  'sprig', 'sprigs', 'bunch', 'bunches', 'head', 'heads',
  'can', 'cans', 'jar', 'jars', 'packet', 'packets', 'package', 'packages',
  'handful', 'handfuls', 'pinch', 'pinches', 'dash', 'dashes',
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

/**
 * Extract the core ingredient name from a recipe ingredient string
 */
function extractIngredientName(ingredientString) {
  if (!ingredientString) return '';

  let text = ingredientString.toLowerCase();

  // Remove content in parentheses
  text = text.replace(/\([^)]*\)/g, ' ');

  // Remove content after common separators for notes
  text = text.replace(/\s*[-–—]\s*(?:note|see|about|approximately).*/i, '');

  // Remove fractions
  text = text.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, ' ');

  // Remove numeric quantities
  text = text.replace(/\b\d+(?:\.\d+)?(?:\s*\/\s*\d+)?\s*/g, ' ');
  text = text.replace(/\b\d+\s*-\s*\d+\b/g, ' ');

  // Remove units
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

  // Take first alternative if multiple given
  const parts = text.split(/\s+or\s+/i);
  if (parts.length > 1) {
    text = parts[0].trim();
  }

  return text;
}

async function buildPantrySuggestions() {
  console.log('Building pantry suggestions...');

  // Read the full recipe data
  const data = JSON.parse(fs.readFileSync(RECIPE_DATA_PATH, 'utf-8'));
  const recipes = data.recipes;

  // Extract and count all ingredients
  const ingredientCounts = new Map();

  for (const recipe of recipes) {
    if (!recipe.ingredients) continue;

    for (const ingredient of recipe.ingredients) {
      const extracted = extractIngredientName(ingredient);
      if (extracted && extracted.length >= 2 && extracted.length <= 50) {
        const count = ingredientCounts.get(extracted) || 0;
        ingredientCounts.set(extracted, count + 1);
      }
    }
  }

  // Sort by frequency (most common first), then alphabetically
  const sortedIngredients = [...ingredientCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]; // More frequent first
      return a[0].localeCompare(b[0]); // Alphabetically
    })
    .map(([name]) => name);

  // Write the suggestions file
  const output = JSON.stringify({
    ingredients: sortedIngredients,
    count: sortedIngredients.length,
    generatedAt: new Date().toISOString()
  }, null, 2);

  fs.writeFileSync(OUTPUT_PATH, output);

  console.log(`Pantry suggestions built: ${sortedIngredients.length} unique ingredients`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log('\nTop 20 most common ingredients:');
  sortedIngredients.slice(0, 20).forEach((name, i) => {
    console.log(`  ${i + 1}. ${name} (${ingredientCounts.get(name)} recipes)`);
  });
}

buildPantrySuggestions().catch(console.error);
