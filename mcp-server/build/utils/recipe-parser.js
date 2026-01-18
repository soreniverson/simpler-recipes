/**
 * Recipe parsing utilities extracted from api/extract.js
 * Handles extraction of recipe data from Schema.org JSON-LD markup
 */
/**
 * Decode HTML entities in a string
 */
export function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string')
        return str ?? '';
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
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
/**
 * Parse ISO 8601 duration to human-readable format
 */
export function parseDuration(duration) {
    if (!duration)
        return null;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match)
        return duration;
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const parts = [];
    if (hours)
        parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
    if (minutes)
        parts.push(`${minutes} min`);
    return parts.join(' ') || null;
}
/**
 * Extract instructions from various formats
 */
export function parseInstructions(instructions) {
    if (!instructions)
        return [];
    if (typeof instructions === 'string') {
        return instructions
            .split(/\n|(?=\d+\.\s)/)
            .map((s) => s.replace(/^\d+\.\s*/, '').trim())
            .filter(Boolean);
    }
    if (Array.isArray(instructions)) {
        return instructions.flatMap((item) => {
            if (typeof item === 'object' && item !== null) {
                const obj = item;
                if (obj['@type'] === 'HowToStep') {
                    return [obj.text || obj.name || ''];
                }
                if (obj['@type'] === 'HowToSection') {
                    return parseInstructions(obj.itemListElement);
                }
                if (obj.text)
                    return [obj.text];
                if (obj.name)
                    return [obj.name];
            }
            if (typeof item === 'string') {
                return [item.replace(/^\d+\.\s*/, '').trim()];
            }
            return [''];
        }).filter(Boolean);
    }
    return [];
}
/**
 * Extract image URL from various formats
 */
export function parseImage(image) {
    if (!image)
        return null;
    if (typeof image === 'string')
        return image;
    if (Array.isArray(image))
        return parseImage(image[0]);
    if (typeof image === 'object' && image !== null) {
        const obj = image;
        return obj.url || obj.contentUrl || null;
    }
    return null;
}
/**
 * Extract recipe yield/servings
 */
export function parseYield(recipeYield) {
    if (!recipeYield)
        return null;
    if (typeof recipeYield === 'number')
        return String(recipeYield);
    if (typeof recipeYield === 'string')
        return recipeYield;
    if (Array.isArray(recipeYield))
        return recipeYield[0]?.toString() || null;
    return null;
}
/**
 * Find Recipe schema from JSON-LD data
 */
export function findRecipeInJsonLd(jsonLd) {
    if (!jsonLd)
        return null;
    if (typeof jsonLd === 'object' && jsonLd !== null) {
        const obj = jsonLd;
        if (obj['@type'] === 'Recipe')
            return obj;
        if (Array.isArray(obj['@type']) && obj['@type'].includes('Recipe'))
            return obj;
        if (obj['@graph'] && Array.isArray(obj['@graph'])) {
            for (const item of obj['@graph']) {
                const recipe = findRecipeInJsonLd(item);
                if (recipe)
                    return recipe;
            }
        }
    }
    if (Array.isArray(jsonLd)) {
        for (const item of jsonLd) {
            const recipe = findRecipeInJsonLd(item);
            if (recipe)
                return recipe;
        }
    }
    return null;
}
/**
 * Extract JSON-LD scripts from HTML
 */
export function extractJsonLdScripts(html) {
    const scripts = [];
    const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        try {
            const json = JSON.parse(match[1]);
            scripts.push(json);
        }
        catch {
            // Invalid JSON, skip
        }
    }
    return scripts;
}
/**
 * Fetch and parse a recipe from a URL
 */
export async function fetchAndParseRecipe(url) {
    // Validate URL
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol - only HTTP and HTTPS are supported');
    }
    // Fetch the page
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SimplerRecipes/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch recipe: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    // Extract JSON-LD scripts
    const jsonLdScripts = extractJsonLdScripts(html);
    // Find recipe schema
    let recipeSchema = null;
    for (const script of jsonLdScripts) {
        recipeSchema = findRecipeInJsonLd(script);
        if (recipeSchema)
            break;
    }
    if (!recipeSchema) {
        throw new Error('No recipe found on this page. The site may not use Schema.org markup.');
    }
    // Parse the recipe
    const recipe = {
        title: decodeHtmlEntities(recipeSchema.name) || 'Untitled Recipe',
        ingredients: Array.isArray(recipeSchema.recipeIngredient)
            ? recipeSchema.recipeIngredient.map(decodeHtmlEntities)
            : [],
        instructions: parseInstructions(recipeSchema.recipeInstructions).map(decodeHtmlEntities),
        prepTime: parseDuration(recipeSchema.prepTime),
        cookTime: parseDuration(recipeSchema.cookTime),
        servings: parseYield(recipeSchema.recipeYield),
        image: parseImage(recipeSchema.image),
        sourceUrl: url,
    };
    // Validate we have at least ingredients or instructions
    if (recipe.ingredients.length === 0 && recipe.instructions.length === 0) {
        throw new Error('Recipe data was found but appears to be incomplete.');
    }
    return recipe;
}
//# sourceMappingURL=recipe-parser.js.map