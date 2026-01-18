#!/usr/bin/env node

/**
 * Recipe Data Cleanup Script
 * Fixes formatting issues in existing recipe data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'recipe-data');

// Clean up ingredient formatting issues
function cleanIngredient(text) {
  if (!text || typeof text !== 'string') return text;

  return text
    // Fix "(, text)" -> "(text)"
    .replace(/\(\s*,\s*/g, '(')
    // Fix double parentheses "((text))" -> "(text)"
    .replace(/\(\(([^)]+)\)\)/g, '($1)')
    // Fix "  ," -> ","
    .replace(/\s+,/g, ',')
    // Fix multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Fix leading/trailing spaces in parentheses "( text )" -> "(text)"
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    // Fix empty parentheses "()"
    .replace(/\(\s*\)/g, '')
    // Fix orphan commas at end ", )" or " ,)"
    .replace(/,\s*\)/g, ')')
    // Trim
    .trim();
}

// Standardize time format
function standardizeTime(timeStr) {
  if (!timeStr) return null;

  // Already in good format
  if (/^\d+\s*(min|hr|hrs)/.test(timeStr)) {
    return timeStr
      .replace(/\bhours?\b/gi, 'hrs')
      .replace(/\bminutes?\b/gi, 'min')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Parse ISO duration format PT1H30M
  const isoMatch = timeStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1]) || 0;
    const minutes = parseInt(isoMatch[2]) || 0;
    const parts = [];
    if (hours) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
    if (minutes) parts.push(`${minutes} min`);
    return parts.join(' ') || null;
  }

  return timeStr;
}

// Clean servings format
function cleanServings(servings) {
  if (!servings) return null;

  // Extract just the number if there's extra text
  const match = String(servings).match(/(\d+)/);
  if (match) {
    return match[1];
  }
  return servings;
}

function cleanRecipe(recipe) {
  return {
    ...recipe,
    prepTime: standardizeTime(recipe.prepTime),
    cookTime: standardizeTime(recipe.cookTime),
    totalTime: standardizeTime(recipe.totalTime),
    servings: cleanServings(recipe.servings),
    ingredients: recipe.ingredients?.map(cleanIngredient) || [],
    instructions: recipe.instructions?.map(i => i?.trim()) || []
  };
}

function cleanCollection(collection) {
  return {
    ...collection,
    recipes: collection.recipes.map(cleanRecipe)
  };
}

async function main() {
  console.log('=== Recipe Data Cleanup ===\n');

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f !== 'all-recipes.json');

  let totalCleaned = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const cleaned = cleanCollection(data);
    cleaned.metadata.lastUpdated = new Date().toISOString();

    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
    console.log(`Cleaned: ${file} (${data.recipes.length} recipes)`);
    totalCleaned += data.recipes.length;
  }

  // Rebuild all-recipes.json
  console.log('\nRebuilding all-recipes.json...');

  const collections = [];
  const allRecipes = [];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    collections.push({
      slug: data.theme.slug,
      name: data.theme.name,
      description: data.theme.description,
      recipeCount: data.recipes.length,
      recipes: data.recipes.map(r => r.slug)
    });

    allRecipes.push(...data.recipes);
  }

  // Deduplicate by slug
  const uniqueRecipes = [];
  const seenSlugs = new Set();
  for (const recipe of allRecipes) {
    if (!seenSlugs.has(recipe.slug)) {
      seenSlugs.add(recipe.slug);
      uniqueRecipes.push(recipe);
    }
  }

  const output = {
    metadata: {
      totalRecipes: uniqueRecipes.length,
      collectionCount: collections.length,
      lastUpdated: new Date().toISOString()
    },
    collections,
    recipes: uniqueRecipes
  };

  fs.writeFileSync(path.join(DATA_DIR, 'all-recipes.json'), JSON.stringify(output, null, 2));

  console.log(`\n=== Cleanup Complete ===`);
  console.log(`Total recipes cleaned: ${totalCleaned}`);
  console.log(`Unique recipes in index: ${uniqueRecipes.length}`);
}

main().catch(console.error);
