/**
 * get_recipe tool
 * Get a specific curated recipe by slug
 */
import { getRecipe } from '../utils/data-loader.js';
export const getRecipeTool = {
    name: 'get_recipe',
    description: 'Get a specific curated recipe by its slug. Returns the full recipe object including title, ingredients, instructions, prep/cook time, servings, and source information.',
    inputSchema: {
        type: 'object',
        properties: {
            slug: {
                type: 'string',
                description: 'The recipe slug (e.g., "chicken-stir-fry", "best-chocolate-chip-cookies")',
            },
        },
        required: ['slug'],
    },
};
export function handleGetRecipe(args) {
    try {
        const { slug } = args;
        if (!slug) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Error: slug parameter is required',
                    },
                ],
                isError: true,
            };
        }
        const recipe = getRecipe(slug);
        if (!recipe) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Recipe not found: "${slug}". Use list_collections to see available recipes.`,
                    },
                ],
                isError: true,
            };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(recipe, null, 2),
                },
            ],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
            content: [
                {
                    type: 'text',
                    text: `Failed to get recipe: ${message}`,
                },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=get-recipe.js.map