/**
 * MCP Server setup and tool routing
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { listCollectionsTool, handleListCollections } from './tools/list-collections.js';
import { getCollectionTool, handleGetCollection } from './tools/get-collection.js';
import { getRecipeTool, handleGetRecipe } from './tools/get-recipe.js';
import { simplifyRecipeTool, handleSimplifyRecipe } from './tools/simplify-recipe.js';
export function createServer() {
    const server = new Server({
        name: 'simpler-recipes',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {},
        },
    });
    // Register tool list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                listCollectionsTool,
                getCollectionTool,
                getRecipeTool,
                simplifyRecipeTool,
            ],
        };
    });
    // Register tool call handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        switch (name) {
            case 'list_collections':
                return handleListCollections();
            case 'get_collection':
                return handleGetCollection(args);
            case 'get_recipe':
                return handleGetRecipe(args);
            case 'simplify_recipe':
                return handleSimplifyRecipe(args);
            default:
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Unknown tool: ${name}`,
                        },
                    ],
                    isError: true,
                };
        }
    });
    return server;
}
//# sourceMappingURL=server.js.map