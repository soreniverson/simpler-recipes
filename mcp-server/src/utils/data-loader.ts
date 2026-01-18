/**
 * Data loader for recipe JSON files
 * Reads from ../recipe-data/ directory
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface RecipeSource {
  name: string;
  url: string;
}

export interface Recipe {
  id: string;
  slug: string;
  title: string;
  image: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  servings: string;
  ingredients: string[];
  instructions: string[];
  tags: string[];
  source: RecipeSource;
  theme: string;
  difficulty: string;
  addedDate: string;
}

export interface CollectionSummary {
  slug: string;
  name: string;
  description: string;
  recipeCount: number;
  recipes: string[]; // Array of recipe slugs
}

export interface Metadata {
  totalRecipes: number;
  collectionCount: number;
  lastUpdated: string;
}

export interface RecipeData {
  metadata: Metadata;
  collections: CollectionSummary[];
  recipes: Recipe[];
}

export interface CollectionWithRecipes {
  slug: string;
  name: string;
  description: string;
  recipeCount: number;
  recipes: Recipe[];
}

let cachedData: RecipeData | null = null;

/**
 * Get the path to the recipe data file
 */
function getDataPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // From mcp-server/build/utils/ go up to simpler-recipes/recipe-data/
  return join(__dirname, '..', '..', '..', 'recipe-data', 'all-recipes.json');
}

/**
 * Load all recipe data from the JSON file
 * Caches the result for subsequent calls
 */
export function loadRecipeData(): RecipeData {
  if (cachedData) {
    return cachedData;
  }

  const dataPath = getDataPath();
  const data = JSON.parse(readFileSync(dataPath, 'utf-8')) as RecipeData;
  cachedData = data;
  return data;
}

/**
 * Clear the cached data (useful for testing or refreshing)
 */
export function clearCache(): void {
  cachedData = null;
}

/**
 * Get all collections with summary info
 */
export function getCollections(): { metadata: Metadata; collections: CollectionSummary[] } {
  const data = loadRecipeData();
  return {
    metadata: data.metadata,
    collections: data.collections.map(c => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      recipeCount: c.recipeCount,
      recipes: c.recipes,
    })),
  };
}

/**
 * Get a specific collection with full recipe details
 */
export function getCollection(slug: string): CollectionWithRecipes | null {
  const data = loadRecipeData();
  const collection = data.collections.find(c => c.slug === slug);

  if (!collection) {
    return null;
  }

  // Get full recipe objects for recipes in this collection
  const recipes = collection.recipes
    .map(recipeSlug => data.recipes.find(r => r.slug === recipeSlug))
    .filter((r): r is Recipe => r !== undefined);

  return {
    slug: collection.slug,
    name: collection.name,
    description: collection.description,
    recipeCount: collection.recipeCount,
    recipes,
  };
}

/**
 * Get a specific recipe by slug
 */
export function getRecipe(slug: string): Recipe | null {
  const data = loadRecipeData();
  return data.recipes.find(r => r.slug === slug) || null;
}

/**
 * Search recipes by query (searches title, ingredients, tags)
 */
export function searchRecipes(query: string): Recipe[] {
  const data = loadRecipeData();
  const lowerQuery = query.toLowerCase();

  return data.recipes.filter(recipe => {
    const searchable = [
      recipe.title,
      ...recipe.ingredients,
      ...recipe.tags,
      recipe.theme,
    ].join(' ').toLowerCase();

    return searchable.includes(lowerQuery);
  });
}
