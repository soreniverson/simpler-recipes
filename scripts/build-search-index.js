#!/usr/bin/env node
/**
 * Build-time script to create an optimized search index
 * This extracts only the fields needed for search, reducing payload size
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RECIPE_DATA_PATH = path.join(__dirname, '../recipe-data/all-recipes.json');
const OUTPUT_PATH = path.join(__dirname, '../public/search-index.json');

async function buildSearchIndex() {
  console.log('Building search index...');

  // Read the full recipe data
  const data = JSON.parse(fs.readFileSync(RECIPE_DATA_PATH, 'utf-8'));
  const recipes = data.recipes;

  // Extract only the fields needed for search
  const searchData = recipes.map((recipe) => ({
    slug: recipe.slug,
    title: recipe.title,
    tags: recipe.tags || [],
    ingredients: recipe.ingredients || [],
    // Include minimal display data
    image: recipe.image || null,
    totalTime: recipe.totalTime || null,
  }));

  // Write the optimized search index
  const output = JSON.stringify(searchData);
  fs.writeFileSync(OUTPUT_PATH, output);

  const originalSize = JSON.stringify(data.recipes).length;
  const optimizedSize = output.length;
  const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);

  console.log(`Search index built: ${searchData.length} recipes`);
  console.log(`Size reduction: ${(originalSize / 1024).toFixed(1)}KB -> ${(optimizedSize / 1024).toFixed(1)}KB (${savings}% smaller)`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

buildSearchIndex().catch(console.error);
