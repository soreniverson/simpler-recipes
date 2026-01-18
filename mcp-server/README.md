# Simpler Recipes MCP Server

An MCP (Model Context Protocol) server that exposes Simpler Recipes functionality to AI assistants like Claude Desktop and Claude Code.

## Features

This server provides four tools:

- **`list_collections`** - Get all available curated recipe collections
- **`get_collection`** - Get all recipes in a specific collection
- **`get_recipe`** - Get a specific curated recipe by slug
- **`simplify_recipe`** - Extract a clean recipe from any URL with Schema.org markup

## Installation

### Prerequisites

- Node.js 18 or later
- The `recipe-data/` directory must exist in the parent directory with `all-recipes.json`

### Build

```bash
cd mcp-server
npm install
npm run build
```

## Usage

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "simpler-recipes": {
      "command": "node",
      "args": ["/path/to/simpler-recipes/mcp-server/build/index.js"]
    }
  }
}
```

Replace `/path/to/simpler-recipes` with the actual path to your installation.

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "simpler-recipes": {
      "command": "node",
      "args": ["./mcp-server/build/index.js"]
    }
  }
}
```

## Tools Reference

### list_collections

Get all available curated recipe collections.

**Input:** None

**Output:**
```json
{
  "metadata": {
    "totalRecipes": 42,
    "collectionCount": 5,
    "lastUpdated": "2026-01-17T23:42:45.334860Z"
  },
  "collections": [
    {
      "slug": "quick-weeknight-dinners",
      "name": "Quick Weeknight Dinners",
      "description": "Fast, easy meals ready in 30 minutes or less",
      "recipeCount": 10,
      "recipes": ["chicken-stir-fry", "spaghetti-aglio-e-olio", ...]
    }
  ]
}
```

### get_collection

Get all recipes in a specific collection.

**Input:**
```json
{
  "slug": "baking-basics"
}
```

**Output:** Full collection object with all recipe details

### get_recipe

Get a specific curated recipe by slug.

**Input:**
```json
{
  "slug": "chicken-stir-fry"
}
```

**Output:**
```json
{
  "id": "chicken-stir-fry",
  "slug": "chicken-stir-fry",
  "title": "Chicken Stir Fry",
  "image": "https://...",
  "prepTime": "20 min",
  "cookTime": "20 min",
  "servings": "6",
  "ingredients": ["4 cups water", "2 cups white rice", ...],
  "instructions": ["Gather all ingredients.", ...],
  "tags": ["quick", "weeknight", "easy", "poultry"],
  "source": {
    "name": "Allrecipes",
    "url": "https://www.allrecipes.com/recipe/223382/chicken-stir-fry/"
  }
}
```

### simplify_recipe

Extract a clean recipe from any URL with Schema.org markup.

**Input:**
```json
{
  "url": "https://www.allrecipes.com/recipe/223382/chicken-stir-fry/"
}
```

**Output:**
```json
{
  "title": "Chicken Stir Fry",
  "ingredients": ["4 cups water", ...],
  "instructions": ["Gather all ingredients.", ...],
  "prepTime": "20 min",
  "cookTime": "20 min",
  "servings": "6",
  "image": "https://...",
  "sourceUrl": "https://www.allrecipes.com/recipe/223382/chicken-stir-fry/"
}
```

## Development

### Watch mode

```bash
npm run watch
```

### Project structure

```
mcp-server/
├── src/
│   ├── index.ts              # Entry point with STDIO transport
│   ├── server.ts             # MCP server setup & tool routing
│   ├── tools/
│   │   ├── list-collections.ts
│   │   ├── get-collection.ts
│   │   ├── get-recipe.ts
│   │   └── simplify-recipe.ts
│   └── utils/
│       ├── recipe-parser.ts  # Schema.org parsing logic
│       └── data-loader.ts    # Recipe JSON data loading
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
