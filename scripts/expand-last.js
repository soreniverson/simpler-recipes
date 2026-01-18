#!/usr/bin/env node

/**
 * Last expansion targeting weak collections
 */

import {
  addRecipeToCollection,
  updateAllRecipesJson
} from './add-recipes.js';

const LAST_RECIPES = [
  {
    collection: 'mexican-favorites',
    tags: ['mexican'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/beef-tacos-with-melting-cheese',
      'https://www.bbcgoodfood.com/recipes/chipotle-chicken-tacos',
      'https://www.bbcgoodfood.com/recipes/chicken-nachos',
      'https://www.bbcgoodfood.com/recipes/smoky-mexican-chicken-fajitas',
      'https://www.bbcgoodfood.com/recipes/slow-cooker-chicken-fajitas',
    ]
  },
  {
    collection: 'indian-cuisine',
    tags: ['indian'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-lamb-curry',
      'https://www.bbcgoodfood.com/recipes/prawn-madras',
      'https://www.bbcgoodfood.com/recipes/chicken-tikka-masala',
    ]
  },
  {
    collection: 'mediterranean-mezze',
    tags: ['mediterranean'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/greek-chicken-with-lemon-herb-rice',
      'https://www.bbcgoodfood.com/recipes/one-pan-greek-chicken-with-lemon-potatoes',
      'https://www.bbcgoodfood.com/recipes/feta-stuffed-peppers',
    ]
  },
  {
    collection: 'italian-classics',
    tags: ['italian'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/one-pot-spaghetti-meatballs',
      'https://www.bbcgoodfood.com/recipes/pizza-margherita',
      'https://www.bbcgoodfood.com/recipes/easy-tomato-soup',
    ]
  },
  {
    collection: 'appetizers-party',
    tags: ['appetizer'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-garlic-bread',
      'https://www.bbcgoodfood.com/recipes/classic-bruschetta',
      'https://www.bbcgoodfood.com/recipes/prawn-toast',
    ]
  },
  {
    collection: 'baking-basics',
    tags: ['baking'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/classic-chocolate-brownies',
      'https://www.bbcgoodfood.com/recipes/ultimate-chocolate-cake',
    ]
  },
  {
    collection: 'one-pot-meals',
    tags: ['one-pot'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/one-pot-cajun-chicken-rice',
      'https://www.bbcgoodfood.com/recipes/one-pot-chilli-rice',
    ]
  },
  {
    collection: 'soups-stews',
    tags: ['soup'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/slow-cooker-beef-stew',
      'https://www.bbcgoodfood.com/recipes/chunky-vegetable-soup',
    ]
  },
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Last Expansion ===\n');

  let totalAdded = 0;

  for (const batch of LAST_RECIPES) {
    console.log(`\n--- ${batch.collection} ---`);

    for (const url of batch.urls) {
      try {
        const result = await addRecipeToCollection(url, batch.collection, batch.tags);
        if (result) {
          totalAdded++;
        }
        await sleep(1500);
      } catch (error) {
        console.error(`  Failed: ${url} - ${error.message}`);
      }
    }
  }

  console.log('\nUpdating master recipe index...');
  updateAllRecipesJson();

  console.log(`\n=== Done! Added ${totalAdded} recipes ===`);
}

main().catch(console.error);
