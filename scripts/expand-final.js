#!/usr/bin/env node

/**
 * Final Catalog Expansion
 * Using confirmed working URLs from various sources
 */

import {
  addRecipeToCollection,
  updateAllRecipesJson
} from './add-recipes.js';

// Final batch of recipes with carefully selected URLs
const FINAL_RECIPES = [
  // Focus on weak collections: Indian, Mexican, Mediterranean
  {
    collection: 'indian-cuisine',
    tags: ['indian', 'curry'],
    urls: [
      // BBC Good Food has reliable URLs
      'https://www.bbcgoodfood.com/recipes/easy-chicken-curry',
      'https://www.bbcgoodfood.com/recipes/lamb-biryani',
      'https://www.bbcgoodfood.com/recipes/lamb-jalfrezi',
      'https://www.bbcgoodfood.com/recipes/korma-paste',
      'https://www.bbcgoodfood.com/recipes/easy-naan',
      'https://www.bbcgoodfood.com/recipes/vegetable-samosas',
      'https://www.bbcgoodfood.com/recipes/chicken-dopiaza',
      'https://www.bbcgoodfood.com/recipes/chicken-jalfrezi',
      'https://www.bbcgoodfood.com/recipes/keema-rice',
      'https://www.bbcgoodfood.com/recipes/aloo-gobi',
    ]
  },
  {
    collection: 'mexican-favorites',
    tags: ['mexican', 'latin'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/beef-tacos',
      'https://www.bbcgoodfood.com/recipes/chicken-quesadillas',
      'https://www.bbcgoodfood.com/recipes/easy-chicken-fajitas',
      'https://www.bbcgoodfood.com/recipes/mexican-bean-soup',
      'https://www.bbcgoodfood.com/recipes/mexican-chicken-burger',
      'https://www.bbcgoodfood.com/recipes/chilli-con-carne',
      'https://www.bbcgoodfood.com/recipes/huevos-rancheros',
      'https://www.bbcgoodfood.com/recipes/nachos',
      'https://www.bbcgoodfood.com/recipes/taco-salad',
    ]
  },
  {
    collection: 'mediterranean-mezze',
    tags: ['mediterranean', 'healthy'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-falafel-burgers',
      'https://www.bbcgoodfood.com/recipes/lamb-kebabs',
      'https://www.bbcgoodfood.com/recipes/easy-tzatziki',
      'https://www.bbcgoodfood.com/recipes/baked-feta-pasta',
      'https://www.bbcgoodfood.com/recipes/mediterranean-chicken',
    ]
  },
  // Boost other weaker collections
  {
    collection: 'italian-classics',
    tags: ['italian', 'pasta'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/spaghetti-bolognese',
      'https://www.bbcgoodfood.com/recipes/easy-pizza-dough',
      'https://www.bbcgoodfood.com/recipes/easy-focaccia',
      'https://www.bbcgoodfood.com/recipes/classic-margherita-pizza',
    ]
  },
  {
    collection: 'asian-inspired',
    tags: ['asian'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-pad-thai',
      'https://www.bbcgoodfood.com/recipes/chicken-katsu-curry',
      'https://www.bbcgoodfood.com/recipes/honey-soy-chicken-noodles',
      'https://www.bbcgoodfood.com/recipes/easy-singapore-noodles',
    ]
  },
  {
    collection: 'appetizers-party',
    tags: ['appetizer', 'party'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-spring-rolls',
      'https://www.bbcgoodfood.com/recipes/garlic-bread',
      'https://www.bbcgoodfood.com/recipes/easy-sausage-rolls',
      'https://www.bbcgoodfood.com/recipes/baked-camembert',
    ]
  },
  {
    collection: 'vegetarian-mains',
    tags: ['vegetarian'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/veggie-chilli',
      'https://www.bbcgoodfood.com/recipes/easy-ratatouille',
      'https://www.bbcgoodfood.com/recipes/easy-vegetable-lasagne',
      'https://www.bbcgoodfood.com/recipes/mushroom-stroganoff',
    ]
  },
  {
    collection: 'soups-stews',
    tags: ['soup', 'comfort'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-leek-potato-soup',
      'https://www.bbcgoodfood.com/recipes/thai-chicken-soup',
    ]
  },
  {
    collection: 'desserts-sweets',
    tags: ['dessert', 'baking'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-chocolate-fudge-cake',
      'https://www.bbcgoodfood.com/recipes/classic-victoria-sandwich',
    ]
  },
  // RecipeTinEats - these tend to work
  {
    collection: 'quick-weeknight-dinners',
    tags: ['quick', 'easy'],
    urls: [
      'https://www.recipetineats.com/lemon-chicken/',
      'https://www.recipetineats.com/chicken-stroganoff/',
      'https://www.recipetineats.com/garlic-herb-butter-roast-chicken/',
    ]
  },
  {
    collection: 'comfort-food-classics',
    tags: ['comfort'],
    urls: [
      'https://www.recipetineats.com/beef-stroganoff/',
      'https://www.recipetineats.com/shepherds-pie/',
    ]
  },
  {
    collection: 'one-pot-meals',
    tags: ['one-pot'],
    urls: [
      'https://www.recipetineats.com/one-pot-pasta/',
      'https://www.recipetineats.com/chicken-cacciatore/',
    ]
  },
  {
    collection: 'grilling-bbq',
    tags: ['grilling', 'bbq'],
    urls: [
      'https://www.recipetineats.com/lamb-chops/',
      'https://www.recipetineats.com/steak/',
    ]
  },
  {
    collection: 'baking-basics',
    tags: ['baking'],
    urls: [
      'https://www.recipetineats.com/cinnamon-rolls/',
      'https://www.recipetineats.com/banana-bread-recipe/',
    ]
  },
  {
    collection: 'healthy-lunches',
    tags: ['healthy', 'lunch'],
    urls: [
      'https://www.recipetineats.com/chicken-caesar-salad/',
      'https://www.recipetineats.com/asian-noodle-salad/',
    ]
  },
  {
    collection: 'breakfast-brunch',
    tags: ['breakfast'],
    urls: [
      'https://www.recipetineats.com/pancakes/',
      'https://www.recipetineats.com/easy-eggs-benedict/',
    ]
  }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Final Expansion ===\n');

  let totalAdded = 0;
  let totalFailed = 0;

  for (const batch of FINAL_RECIPES) {
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
        totalFailed++;
      }
    }
  }

  console.log('\nUpdating master recipe index...');
  updateAllRecipesJson();

  console.log('\n=== Expansion Complete ===');
  console.log(`Added: ${totalAdded} recipes`);
  console.log(`Failed: ${totalFailed} recipes`);
}

main().catch(console.error);
