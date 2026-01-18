/**
 * simplify_recipe tool
 * Extract clean recipe from any URL with Schema.org markup
 */

import { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { fetchAndParseRecipe } from '../utils/recipe-parser.js';

export const simplifyRecipeTool: Tool = {
  name: 'simplify_recipe',
  description: 'Extract a clean, simplified recipe from any URL that has Schema.org recipe markup (works with most major recipe sites like AllRecipes, Food Network, Serious Eats, etc.). Returns just the essential recipe information: title, ingredients, instructions, prep/cook time, servings, and image.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL of the recipe page to extract from (e.g., "https://www.allrecipes.com/recipe/123/...")',
      },
    },
    required: ['url'],
  },
};

export async function handleSimplifyRecipe(args: { url: string }): Promise<CallToolResult> {
  try {
    const { url } = args;

    if (!url) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: url parameter is required',
          },
        ],
        isError: true,
      };
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Invalid URL format: "${url}"`,
          },
        ],
        isError: true,
      };
    }

    const recipe = await fetchAndParseRecipe(url);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(recipe, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Failed to extract recipe: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
