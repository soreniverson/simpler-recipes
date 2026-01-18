#!/usr/bin/env node

/**
 * Additional Catalog Expansion - Part 2
 * Using more reliable URLs from various sources
 */

import {
  extractRecipe,
  loadCollection,
  saveCollection,
  updateAllRecipesJson,
  addRecipeToCollection
} from './add-recipes.js';

// More recipes with tested/reliable URLs
const MORE_RECIPES = [
  // More Asian
  {
    collection: 'asian-inspired',
    tags: ['asian', 'chinese'],
    urls: [
      'https://www.recipetineats.com/orange-chicken/',
      'https://www.recipetineats.com/mongolian-beef/',
      'https://www.recipetineats.com/dan-dan-noodles/',
      'https://www.recipetineats.com/sesame-chicken/',
      'https://www.recipetineats.com/chicken-lettuce-wraps/',
      'https://www.recipetineats.com/chicken-satay/',
    ]
  },
  // More Indian
  {
    collection: 'indian-cuisine',
    tags: ['indian', 'curry'],
    urls: [
      'https://www.recipetineats.com/vindaloo-curry/',
      'https://www.recipetineats.com/madras-curry/',
      'https://www.recipetineats.com/chicken-korma/',
      'https://www.recipetineats.com/keema-matar/',
      'https://www.recipetineats.com/lamb-curry/',
    ]
  },
  // More Mexican
  {
    collection: 'mexican-favorites',
    tags: ['mexican', 'latin'],
    urls: [
      'https://www.recipetineats.com/mexican-rice/',
      'https://www.recipetineats.com/slow-cooked-beef-brisket-tacos/',
      'https://www.recipetineats.com/chilaquiles/',
      'https://www.recipetineats.com/authentic-mexican-salsa/',
      'https://www.recipetineats.com/carnitas/',
    ]
  },
  // More Italian
  {
    collection: 'italian-classics',
    tags: ['italian', 'pasta'],
    urls: [
      'https://www.recipetineats.com/pasta-alla-norma/',
      'https://www.recipetineats.com/cacio-e-pepe/',
      'https://www.recipetineats.com/pesto-pasta/',
      'https://www.recipetineats.com/creamy-tuscan-chicken/',
      'https://www.recipetineats.com/chicken-piccata/',
      'https://www.recipetineats.com/lasagna/',
    ]
  },
  // More Mediterranean
  {
    collection: 'mediterranean-mezze',
    tags: ['mediterranean', 'healthy'],
    urls: [
      'https://www.recipetineats.com/chicken-gyros/',
      'https://www.recipetineats.com/lamb-gyros/',
      'https://www.recipetineats.com/greek-lemon-chicken/',
      'https://www.recipetineats.com/stuffed-capsicum-peppers/',
    ]
  },
  // More Soups
  {
    collection: 'soups-stews',
    tags: ['soup', 'comfort'],
    urls: [
      'https://www.recipetineats.com/pumpkin-soup/',
      'https://www.recipetineats.com/chicken-soup/',
      'https://www.recipetineats.com/minestrone-soup/',
      'https://www.recipetineats.com/laksa/',
      'https://www.recipetineats.com/corn-chowder/',
    ]
  },
  // More Desserts
  {
    collection: 'desserts-sweets',
    tags: ['dessert', 'sweet'],
    urls: [
      'https://www.recipetineats.com/chocolate-brownies/',
      'https://www.recipetineats.com/new-york-baked-cheesecake/',
      'https://www.recipetineats.com/lemon-curd/',
      'https://www.recipetineats.com/pavlova/',
      'https://www.recipetineats.com/chocolate-self-saucing-pudding/',
    ]
  },
  // Quick Dinners
  {
    collection: 'quick-weeknight-dinners',
    tags: ['quick', 'easy'],
    urls: [
      'https://www.recipetineats.com/garlic-butter-chicken/',
      'https://www.recipetineats.com/crispy-pan-fried-fish/',
      'https://www.recipetineats.com/honey-soy-chicken/',
      'https://www.recipetineats.com/creamy-garlic-prawns/',
      'https://www.recipetineats.com/5-minute-teriyaki-chicken/',
    ]
  },
  // Comfort Food
  {
    collection: 'comfort-food-classics',
    tags: ['comfort', 'hearty'],
    urls: [
      'https://www.recipetineats.com/cottage-pie/',
      'https://www.recipetineats.com/slow-cooker-beef-stew/',
      'https://www.recipetineats.com/chicken-schnitzel/',
      'https://www.recipetineats.com/salisbury-steak/',
    ]
  },
  // Breakfast
  {
    collection: 'breakfast-brunch',
    tags: ['breakfast', 'brunch'],
    urls: [
      'https://www.recipetineats.com/french-toast/',
      'https://www.recipetineats.com/eggs-benedict/',
      'https://www.recipetineats.com/shakshuka/',
      'https://www.recipetineats.com/buttermilk-pancakes/',
    ]
  },
  // Grilling
  {
    collection: 'grilling-bbq',
    tags: ['grilling', 'bbq'],
    urls: [
      'https://www.recipetineats.com/peri-peri-chicken/',
      'https://www.recipetineats.com/bbq-beef-ribs/',
      'https://www.recipetineats.com/grilled-lamb-chops/',
      'https://www.recipetineats.com/chimichurri/',
    ]
  },
  // Vegetarian
  {
    collection: 'vegetarian-mains',
    tags: ['vegetarian'],
    urls: [
      'https://www.recipetineats.com/vegetable-fried-rice/',
      'https://www.recipetineats.com/cauliflower-curry/',
      'https://www.recipetineats.com/stuffed-mushrooms/',
      'https://www.recipetineats.com/vegetable-stir-fry/',
    ]
  },
  // Appetizers
  {
    collection: 'appetizers-party',
    tags: ['appetizer', 'party'],
    urls: [
      'https://www.recipetineats.com/crispy-wonton/',
      'https://www.recipetineats.com/spinach-dip/',
      'https://www.recipetineats.com/cheese-straws/',
      'https://www.recipetineats.com/prawn-toast/',
    ]
  },
  // Healthy
  {
    collection: 'healthy-lunches',
    tags: ['healthy', 'light'],
    urls: [
      'https://www.recipetineats.com/thai-beef-salad/',
      'https://www.recipetineats.com/vietnamese-noodle-salad/',
      'https://www.recipetineats.com/salmon-salad/',
      'https://www.recipetineats.com/fattoush-salad/',
    ]
  },
  // One-pot
  {
    collection: 'one-pot-meals',
    tags: ['one-pot', 'easy'],
    urls: [
      'https://www.recipetineats.com/one-pot-chicken-rice/',
      'https://www.recipetineats.com/slow-cooker-pulled-pork/',
      'https://www.recipetineats.com/ramen/',
      'https://www.recipetineats.com/paella/',
    ]
  },
  // Baking
  {
    collection: 'baking-basics',
    tags: ['baking'],
    urls: [
      'https://www.recipetineats.com/chocolate-chip-cookies/',
      'https://www.recipetineats.com/banana-bread/',
      'https://www.recipetineats.com/blueberry-muffins/',
      'https://www.recipetineats.com/carrot-cake/',
    ]
  },
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Additional Catalog Expansion ===\n');

  let totalAdded = 0;
  let totalFailed = 0;

  for (const batch of MORE_RECIPES) {
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
