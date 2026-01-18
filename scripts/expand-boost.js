#!/usr/bin/env node

/**
 * Final boost to hit 250 recipes
 */

import {
  addRecipeToCollection,
  updateAllRecipesJson
} from './add-recipes.js';

const BOOST_RECIPES = [
  // Boost weaker collections - Indian, Mexican, Mediterranean
  {
    collection: 'indian-cuisine',
    tags: ['indian', 'curry'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-tikka-masala',
      'https://www.bbcgoodfood.com/recipes/spinach-dal',
      'https://www.bbcgoodfood.com/recipes/saag-paneer',
      'https://www.bbcgoodfood.com/recipes/chicken-bhuna',
      'https://www.bbcgoodfood.com/recipes/lamb-kofta-curry',
      'https://www.bbcgoodfood.com/recipes/vegetable-curry',
    ]
  },
  {
    collection: 'mexican-favorites',
    tags: ['mexican', 'latin'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-beef-burrito',
      'https://www.bbcgoodfood.com/recipes/beef-chilli',
      'https://www.bbcgoodfood.com/recipes/chicken-burrito-bowl',
      'https://www.bbcgoodfood.com/recipes/easy-bean-chilli',
      'https://www.bbcgoodfood.com/recipes/mexican-rice',
    ]
  },
  {
    collection: 'mediterranean-mezze',
    tags: ['mediterranean'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-hummus',
      'https://www.bbcgoodfood.com/recipes/shakshuka',
      'https://www.bbcgoodfood.com/recipes/greek-salad',
      'https://www.bbcgoodfood.com/recipes/lamb-moussaka',
      'https://www.bbcgoodfood.com/recipes/stuffed-peppers',
    ]
  },
  // Boost others
  {
    collection: 'asian-inspired',
    tags: ['asian'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/crispy-chilli-beef',
      'https://www.bbcgoodfood.com/recipes/sweet-sour-chicken',
      'https://www.bbcgoodfood.com/recipes/chicken-noodle-soup',
      'https://www.bbcgoodfood.com/recipes/chicken-ramen',
      'https://www.bbcgoodfood.com/recipes/miso-soup',
    ]
  },
  {
    collection: 'italian-classics',
    tags: ['italian'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-tomato-pasta',
      'https://www.bbcgoodfood.com/recipes/creamy-mushroom-pasta',
      'https://www.bbcgoodfood.com/recipes/pasta-bake',
      'https://www.bbcgoodfood.com/recipes/meatballs',
      'https://www.bbcgoodfood.com/recipes/easy-carbonara',
    ]
  },
  {
    collection: 'soups-stews',
    tags: ['soup'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/vegetable-soup',
      'https://www.bbcgoodfood.com/recipes/chicken-noodle-soup',
      'https://www.bbcgoodfood.com/recipes/carrot-soup',
      'https://www.bbcgoodfood.com/recipes/pea-soup',
    ]
  },
  {
    collection: 'desserts-sweets',
    tags: ['dessert', 'baking'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/chocolate-brownies',
      'https://www.bbcgoodfood.com/recipes/easy-pancakes',
      'https://www.bbcgoodfood.com/recipes/apple-crumble',
      'https://www.bbcgoodfood.com/recipes/lemon-drizzle-cake',
      'https://www.bbcgoodfood.com/recipes/chocolate-chip-cookies',
    ]
  },
  {
    collection: 'breakfast-brunch',
    tags: ['breakfast'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-pancakes',
      'https://www.bbcgoodfood.com/recipes/fluffy-american-pancakes',
      'https://www.bbcgoodfood.com/recipes/easy-omelette',
      'https://www.bbcgoodfood.com/recipes/scrambled-eggs',
    ]
  },
  {
    collection: 'quick-weeknight-dinners',
    tags: ['quick', 'easy'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-fried-rice',
      'https://www.bbcgoodfood.com/recipes/chicken-stir-fry',
      'https://www.bbcgoodfood.com/recipes/beef-stir-fry',
      'https://www.bbcgoodfood.com/recipes/prawn-stir-fry',
    ]
  },
  {
    collection: 'comfort-food-classics',
    tags: ['comfort'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/fish-pie',
      'https://www.bbcgoodfood.com/recipes/chicken-pie',
      'https://www.bbcgoodfood.com/recipes/cottage-pie',
      'https://www.bbcgoodfood.com/recipes/beef-stew',
    ]
  },
  {
    collection: 'one-pot-meals',
    tags: ['one-pot'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/one-pot-chicken',
      'https://www.bbcgoodfood.com/recipes/one-pot-rice',
      'https://www.bbcgoodfood.com/recipes/risotto',
      'https://www.bbcgoodfood.com/recipes/paella',
    ]
  },
  {
    collection: 'healthy-lunches',
    tags: ['healthy'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/tuna-salad',
      'https://www.bbcgoodfood.com/recipes/chicken-wrap',
      'https://www.bbcgoodfood.com/recipes/prawn-salad',
    ]
  },
  {
    collection: 'vegetarian-mains',
    tags: ['vegetarian'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/veggie-stir-fry',
      'https://www.bbcgoodfood.com/recipes/veggie-curry',
      'https://www.bbcgoodfood.com/recipes/spinach-ricotta-cannelloni',
    ]
  },
  {
    collection: 'appetizers-party',
    tags: ['appetizer'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/chicken-satay-skewers',
      'https://www.bbcgoodfood.com/recipes/halloumi-fries',
      'https://www.bbcgoodfood.com/recipes/cheese-straws',
    ]
  },
  {
    collection: 'grilling-bbq',
    tags: ['grilling'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/bbq-chicken',
      'https://www.bbcgoodfood.com/recipes/bbq-ribs',
      'https://www.bbcgoodfood.com/recipes/grilled-chicken',
    ]
  },
  {
    collection: 'baking-basics',
    tags: ['baking'],
    urls: [
      'https://www.bbcgoodfood.com/recipes/easy-bread',
      'https://www.bbcgoodfood.com/recipes/chocolate-cake',
      'https://www.bbcgoodfood.com/recipes/scones',
      'https://www.bbcgoodfood.com/recipes/banana-bread',
    ]
  },
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Final Boost ===\n');

  let totalAdded = 0;
  let totalFailed = 0;

  for (const batch of BOOST_RECIPES) {
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
