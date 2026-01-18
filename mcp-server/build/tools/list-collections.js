/**
 * list_collections tool
 * Get all available curated recipe collections
 */
import { getCollections } from '../utils/data-loader.js';
export const listCollectionsTool = {
    name: 'list_collections',
    description: 'Get all available curated recipe collections. Returns metadata about the recipe database and a list of collections with their names, descriptions, and recipe counts.',
    inputSchema: {
        type: 'object',
        properties: {},
        required: [],
    },
};
export function handleListCollections() {
    try {
        const data = getCollections();
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(data, null, 2),
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
                    text: `Failed to list collections: ${message}`,
                },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=list-collections.js.map