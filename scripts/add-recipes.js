#!/usr/bin/env node

/**
 * Script to batch-add recipes to collections
 * Usage: node scripts/add-recipes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'recipe-data');

// Helper functions (same as extract.ts)
function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str || '';

  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&apos;': "'",
    '&#x2F;': '/',
    '&#47;': '/',
    '&nbsp;': ' ',
  };

  return str
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x27|#x2F|#47);/gi, (match) => entities[match] || match)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseDuration(duration) {
  if (!duration) return null;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;

  const parts = [];
  if (hours) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  if (minutes) parts.push(`${minutes} min`);

  return parts.join(' ') || null;
}

function parseInstructions(instructions) {
  if (!instructions) return [];

  if (typeof instructions === 'string') {
    return instructions
      .split(/\n|(?=\d+\.\s)/)
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }

  if (Array.isArray(instructions)) {
    return instructions.flatMap((item) => {
      if (typeof item === 'object' && item !== null) {
        if (item['@type'] === 'HowToStep') {
          return item.text || item.name || '';
        }
        if (item['@type'] === 'HowToSection') {
          return parseInstructions(item.itemListElement);
        }
        if (item.text) return item.text;
        if (item.name) return item.name;
      }
      if (typeof item === 'string') {
        return item.replace(/^\d+\.\s*/, '').trim();
      }
      return '';
    }).filter(Boolean);
  }

  return [];
}

function parseImage(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return parseImage(image[0]);
  if (typeof image === 'object') return image.url || image.contentUrl || null;
  return null;
}

function parseYield(recipeYield) {
  if (!recipeYield) return null;
  if (typeof recipeYield === 'number') return String(recipeYield);
  if (typeof recipeYield === 'string') return recipeYield;
  if (Array.isArray(recipeYield)) return recipeYield[0]?.toString() || null;
  return null;
}

function findRecipeInJsonLd(jsonLd) {
  if (!jsonLd) return null;

  if (jsonLd['@type'] === 'Recipe') return jsonLd;
  if (Array.isArray(jsonLd['@type']) && jsonLd['@type'].includes('Recipe')) return jsonLd;

  if (Array.isArray(jsonLd)) {
    for (const item of jsonLd) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }

  if (jsonLd['@graph'] && Array.isArray(jsonLd['@graph'])) {
    for (const item of jsonLd['@graph']) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }

  return null;
}

function extractJsonLdScripts(html) {
  const scripts = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      scripts.push(json);
    } catch {
      // Invalid JSON, skip
    }
  }

  return scripts;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function cleanIngredient(text) {
  return text
    .replace(/\(\(([^)]+)\)\)/g, '($1)')
    .replace(/\(\s*,\s*/g, '(')
    .trim();
}

function standardizeTime(timeStr) {
  if (!timeStr) return null;

  // Already standardized
  if (/^\d+\s*(min|hr|hrs|hour|hours)/.test(timeStr)) {
    return timeStr
      .replace(/\bhours?\b/gi, 'hrs')
      .replace(/\bminutes?\b/gi, 'min');
  }

  return timeStr;
}

async function extractRecipe(url) {
  console.log(`Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SimplerRecipes/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const html = await response.text();
  const jsonLdScripts = extractJsonLdScripts(html);

  let recipeSchema = null;
  for (const script of jsonLdScripts) {
    recipeSchema = findRecipeInJsonLd(script);
    if (recipeSchema) break;
  }

  if (!recipeSchema) {
    throw new Error('No recipe schema found');
  }

  const title = decodeHtmlEntities(recipeSchema.name) || 'Untitled Recipe';
  const slug = slugify(title);

  return {
    id: slug,
    slug: slug,
    title: title,
    image: parseImage(recipeSchema.image),
    prepTime: standardizeTime(parseDuration(recipeSchema.prepTime)),
    cookTime: standardizeTime(parseDuration(recipeSchema.cookTime)),
    totalTime: standardizeTime(parseDuration(recipeSchema.totalTime)),
    servings: parseYield(recipeSchema.recipeYield),
    ingredients: Array.isArray(recipeSchema.recipeIngredient)
      ? recipeSchema.recipeIngredient.map(i => cleanIngredient(decodeHtmlEntities(i)))
      : [],
    instructions: parseInstructions(recipeSchema.recipeInstructions).map(decodeHtmlEntities),
    tags: [],
    source: {
      name: new URL(url).hostname.replace('www.', ''),
      url: url
    },
    difficulty: 'Medium',
    addedDate: new Date().toISOString()
  };
}

function loadCollection(slug) {
  const filePath = path.join(DATA_DIR, `${slug}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return null;
}

function saveCollection(collection) {
  const filePath = path.join(DATA_DIR, `${collection.theme.slug}.json`);
  collection.metadata.recipeCount = collection.recipes.length;
  collection.metadata.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(collection, null, 2));
  console.log(`Saved ${collection.theme.slug} with ${collection.recipes.length} recipes`);
}

function createCollection(slug, name, description) {
  return {
    theme: { slug, name, description },
    metadata: { recipeCount: 0, lastUpdated: new Date().toISOString() },
    recipes: []
  };
}

function updateAllRecipesJson() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'all-recipes.json');

  const collections = [];
  const allRecipes = [];

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
    collections.push({
      slug: data.theme.slug,
      name: data.theme.name,
      description: data.theme.description,
      recipeCount: data.recipes.length,
      recipes: data.recipes.map(r => r.slug)
    });
    allRecipes.push(...data.recipes);
  }

  // Deduplicate recipes by slug
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
    collections: collections,
    recipes: uniqueRecipes
  };

  fs.writeFileSync(path.join(DATA_DIR, 'all-recipes.json'), JSON.stringify(output, null, 2));
  console.log(`Updated all-recipes.json: ${uniqueRecipes.length} recipes, ${collections.length} collections`);
}

async function addRecipeToCollection(url, collectionSlug, tags = [], theme = null) {
  try {
    const recipe = await extractRecipe(url);
    recipe.tags = tags;
    if (theme) recipe.theme = theme;

    let collection = loadCollection(collectionSlug);
    if (!collection) {
      throw new Error(`Collection ${collectionSlug} not found`);
    }

    // Check for duplicates
    if (collection.recipes.some(r => r.slug === recipe.slug)) {
      console.log(`  Skipping duplicate: ${recipe.title}`);
      return null;
    }

    recipe.theme = collection.theme.name;
    collection.recipes.push(recipe);
    saveCollection(collection);

    console.log(`  Added: ${recipe.title}`);
    return recipe;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return null;
  }
}

// Export for use as module
export {
  extractRecipe,
  loadCollection,
  saveCollection,
  createCollection,
  updateAllRecipesJson,
  addRecipeToCollection
};

// If run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Recipe addition script loaded.');
  console.log('Import and use the functions, or modify this script to batch add recipes.');
}
