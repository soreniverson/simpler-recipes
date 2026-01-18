/**
 * get_collection tool
 * Get all recipes in a specific collection
 */

import { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getCollection } from '../utils/data-loader.js';

export const getCollectionTool: Tool = {
  name: 'get_collection',
  description: 'Get all recipes in a specific collection by its slug. Returns the collection metadata along with full details for all recipes in that collection.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: {
        type: 'string',
        description: 'The collection slug (e.g., "quick-weeknight-dinners", "baking-basics", "one-pot-meals")',
      },
    },
    required: ['slug'],
  },
};

export function handleGetCollection(args: { slug: string }): CallToolResult {
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

    const collection = getCollection(slug);

    if (!collection) {
      return {
        content: [
          {
            type: 'text',
            text: `Collection not found: "${slug}". Use list_collections to see available collections.`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(collection, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Failed to get collection: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
