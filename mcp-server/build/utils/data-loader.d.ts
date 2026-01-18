/**
 * Data loader for recipe JSON files
 * Reads from ../recipe-data/ directory
 */
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
    recipes: string[];
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
/**
 * Load all recipe data from the JSON file
 * Caches the result for subsequent calls
 */
export declare function loadRecipeData(): RecipeData;
/**
 * Clear the cached data (useful for testing or refreshing)
 */
export declare function clearCache(): void;
/**
 * Get all collections with summary info
 */
export declare function getCollections(): {
    metadata: Metadata;
    collections: CollectionSummary[];
};
/**
 * Get a specific collection with full recipe details
 */
export declare function getCollection(slug: string): CollectionWithRecipes | null;
/**
 * Get a specific recipe by slug
 */
export declare function getRecipe(slug: string): Recipe | null;
/**
 * Search recipes by query (searches title, ingredients, tags)
 */
export declare function searchRecipes(query: string): Recipe[];
//# sourceMappingURL=data-loader.d.ts.map