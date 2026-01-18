/**
 * Recipe parsing utilities extracted from api/extract.js
 * Handles extraction of recipe data from Schema.org JSON-LD markup
 */
export interface ParsedRecipe {
    title: string;
    ingredients: string[];
    instructions: string[];
    prepTime: string | null;
    cookTime: string | null;
    servings: string | null;
    image: string | null;
    sourceUrl: string;
}
interface JsonLdObject {
    '@type'?: string | string[];
    '@graph'?: JsonLdObject[];
    name?: string;
    recipeIngredient?: string[];
    recipeInstructions?: unknown;
    prepTime?: string;
    cookTime?: string;
    recipeYield?: string | number | string[];
    image?: unknown;
    text?: string;
    itemListElement?: unknown;
    url?: string;
    contentUrl?: string;
}
/**
 * Decode HTML entities in a string
 */
export declare function decodeHtmlEntities(str: string | undefined | null): string;
/**
 * Parse ISO 8601 duration to human-readable format
 */
export declare function parseDuration(duration: string | undefined | null): string | null;
/**
 * Extract instructions from various formats
 */
export declare function parseInstructions(instructions: unknown): string[];
/**
 * Extract image URL from various formats
 */
export declare function parseImage(image: unknown): string | null;
/**
 * Extract recipe yield/servings
 */
export declare function parseYield(recipeYield: string | number | string[] | undefined | null): string | null;
/**
 * Find Recipe schema from JSON-LD data
 */
export declare function findRecipeInJsonLd(jsonLd: unknown): JsonLdObject | null;
/**
 * Extract JSON-LD scripts from HTML
 */
export declare function extractJsonLdScripts(html: string): unknown[];
/**
 * Fetch and parse a recipe from a URL
 */
export declare function fetchAndParseRecipe(url: string): Promise<ParsedRecipe>;
export {};
//# sourceMappingURL=recipe-parser.d.ts.map