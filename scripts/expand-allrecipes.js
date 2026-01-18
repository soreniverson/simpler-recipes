#!/usr/bin/env node

/**
 * Additional Catalog Expansion - AllRecipes
 * Using AllRecipes URLs which have stable structures
 */

import {
  addRecipeToCollection,
  updateAllRecipesJson
} from './add-recipes.js';

// AllRecipes URLs (these have stable formats)
const ALLRECIPES_BATCH = [
  // Mexican
  {
    collection: 'mexican-favorites',
    tags: ['mexican', 'latin'],
    urls: [
      'https://www.allrecipes.com/recipe/16167/beef-enchiladas/',
      'https://www.allrecipes.com/recipe/70461/chicken-enchiladas/',
      'https://www.allrecipes.com/recipe/51103/restaurant-style-taco-meat-seasoning/',
      'https://www.allrecipes.com/recipe/219108/authentic-mexican-guacamole/',
      'https://www.allrecipes.com/recipe/14231/salsa/',
      'https://www.allrecipes.com/recipe/16449/burritos/',
      'https://www.allrecipes.com/recipe/213742/taco-seasoning/',
      'https://www.allrecipes.com/recipe/24096/refried-beans-without-the-refry/',
    ]
  },
  // Italian
  {
    collection: 'italian-classics',
    tags: ['italian', 'pasta'],
    urls: [
      'https://www.allrecipes.com/recipe/11973/spaghetti-carbonara-ii/',
      'https://www.allrecipes.com/recipe/235655/super-simple-garlic-butter-pasta/',
      'https://www.allrecipes.com/recipe/85389/gourmet-mushroom-risotto/',
      'https://www.allrecipes.com/recipe/18439/easy-bruschetta/',
      'https://www.allrecipes.com/recipe/12966/best-italian-sausage-soup/',
      'https://www.allrecipes.com/recipe/236679/classic-tiramisu/',
    ]
  },
  // Asian
  {
    collection: 'asian-inspired',
    tags: ['asian'],
    urls: [
      'https://www.allrecipes.com/recipe/223382/mongolian-beef/',
      'https://www.allrecipes.com/recipe/223234/easy-sesame-chicken/',
      'https://www.allrecipes.com/recipe/228823/quick-beef-stir-fry/',
      'https://www.allrecipes.com/recipe/16805/restaurant-style-beef-and-broccoli/',
      'https://www.allrecipes.com/recipe/43917/asian-lettuce-wraps/',
      'https://www.allrecipes.com/recipe/19621/egg-drop-soup/',
    ]
  },
  // Indian
  {
    collection: 'indian-cuisine',
    tags: ['indian', 'curry'],
    urls: [
      'https://www.allrecipes.com/recipe/212721/indian-chicken-curry/',
      'https://www.allrecipes.com/recipe/46822/indian-chicken-korma/',
      'https://www.allrecipes.com/recipe/14795/easy-naan/',
      'https://www.allrecipes.com/recipe/236012/slow-cooker-indian-butter-chicken/',
      'https://www.allrecipes.com/recipe/80097/indian-style-rice/',
    ]
  },
  // Mediterranean
  {
    collection: 'mediterranean-mezze',
    tags: ['mediterranean', 'healthy'],
    urls: [
      'https://www.allrecipes.com/recipe/233753/baked-falafel/',
      'https://www.allrecipes.com/recipe/29288/baba-ghanoush/',
      'https://www.allrecipes.com/recipe/173499/greek-gyros/',
      'https://www.allrecipes.com/recipe/14403/mediterranean-greek-salad/',
    ]
  },
  // Soups
  {
    collection: 'soups-stews',
    tags: ['soup', 'comfort'],
    urls: [
      'https://www.allrecipes.com/recipe/26460/quick-and-easy-chicken-noodle-soup/',
      'https://www.allrecipes.com/recipe/13107/rich-and-simple-french-onion-soup/',
      'https://www.allrecipes.com/recipe/13398/rich-and-creamy-tomato-basil-soup/',
      'https://www.allrecipes.com/recipe/228443/curry-pumpkin-soup/',
      'https://www.allrecipes.com/recipe/24922/absolutely-ultimate-potato-soup/',
    ]
  },
  // Desserts
  {
    collection: 'desserts-sweets',
    tags: ['dessert', 'sweet', 'baking'],
    urls: [
      'https://www.allrecipes.com/recipe/25037/best-brownies/',
      'https://www.allrecipes.com/recipe/151148/lemon-bars-deluxe/',
      'https://www.allrecipes.com/recipe/10549/best-chocolate-chip-cookies/',
      'https://www.allrecipes.com/recipe/6099/vanilla-cupcakes/',
      'https://www.allrecipes.com/recipe/16752/chocolate-eclair-cake/',
    ]
  },
  // Quick Dinners
  {
    collection: 'quick-weeknight-dinners',
    tags: ['quick', 'easy', 'weeknight'],
    urls: [
      'https://www.allrecipes.com/recipe/228293/crispy-and-tender-baked-chicken-thighs/',
      'https://www.allrecipes.com/recipe/228285/teriyaki-chicken/',
      'https://www.allrecipes.com/recipe/219173/one-pot-pasta/',
      'https://www.allrecipes.com/recipe/244716/one-pan-orecchiette-pasta/',
    ]
  },
  // Comfort Food
  {
    collection: 'comfort-food-classics',
    tags: ['comfort', 'classic', 'hearty'],
    urls: [
      'https://www.allrecipes.com/recipe/11679/homemade-mac-and-cheese/',
      'https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/',
      'https://www.allrecipes.com/recipe/16354/easy-meatloaf/',
      'https://www.allrecipes.com/recipe/25678/turkey-a-la-king/',
    ]
  },
  // Breakfast
  {
    collection: 'breakfast-brunch',
    tags: ['breakfast', 'brunch'],
    urls: [
      'https://www.allrecipes.com/recipe/16895/fluffy-french-toast/',
      'https://www.allrecipes.com/recipe/20513/classic-waffles/',
      'https://www.allrecipes.com/recipe/22180/waffles-i/',
      'https://www.allrecipes.com/recipe/17891/oatmeal-pancakes/',
    ]
  },
  // Grilling
  {
    collection: 'grilling-bbq',
    tags: ['grilling', 'bbq', 'summer'],
    urls: [
      'https://www.allrecipes.com/recipe/143809/best-bbq-ribs-ever/',
      'https://www.allrecipes.com/recipe/54422/worlds-best-honey-garlic-pork-chops/',
      'https://www.allrecipes.com/recipe/15076/marinaded-flank-steak/',
      'https://www.allrecipes.com/recipe/70522/grilled-asparagus/',
    ]
  },
  // Vegetarian
  {
    collection: 'vegetarian-mains',
    tags: ['vegetarian', 'meatless'],
    urls: [
      'https://www.allrecipes.com/recipe/35503/best-spinach-artichoke-dip/',
      'https://www.allrecipes.com/recipe/245362/easy-vegetable-fried-rice/',
      'https://www.allrecipes.com/recipe/25238/vegetarian-korma/',
      'https://www.allrecipes.com/recipe/85452/roasted-vegetable-medley/',
    ]
  },
  // Appetizers
  {
    collection: 'appetizers-party',
    tags: ['appetizer', 'party', 'snack'],
    urls: [
      'https://www.allrecipes.com/recipe/31244/honey-garlic-shrimp/',
      'https://www.allrecipes.com/recipe/86570/bacon-wrapped-water-chestnuts/',
      'https://www.allrecipes.com/recipe/22983/crab-stuffed-mushrooms/',
      'https://www.allrecipes.com/recipe/14145/caprese-salad/',
    ]
  },
  // Healthy Lunches
  {
    collection: 'healthy-lunches',
    tags: ['healthy', 'lunch', 'light'],
    urls: [
      'https://www.allrecipes.com/recipe/14276/strawberry-spinach-salad/',
      'https://www.allrecipes.com/recipe/8540/simply-chicken-salad/',
      'https://www.allrecipes.com/recipe/16409/garden-salad/',
      'https://www.allrecipes.com/recipe/85584/asian-chicken-salad/',
    ]
  },
  // One-pot
  {
    collection: 'one-pot-meals',
    tags: ['one-pot', 'easy', 'minimal-cleanup'],
    urls: [
      'https://www.allrecipes.com/recipe/231974/one-pot-creamy-spaghetti/',
      'https://www.allrecipes.com/recipe/246628/one-pan-chicken-fajitas/',
      'https://www.allrecipes.com/recipe/228823/quick-beef-stir-fry/',
      'https://www.allrecipes.com/recipe/73303/cajun-chicken-pasta/',
    ]
  },
  // Baking
  {
    collection: 'baking-basics',
    tags: ['baking', 'dessert'],
    urls: [
      'https://www.allrecipes.com/recipe/10813/best-chocolate-cake/',
      'https://www.allrecipes.com/recipe/17481/simple-white-cake/',
      'https://www.allrecipes.com/recipe/216756/jans-fresh-apple-cake/',
      'https://www.allrecipes.com/recipe/7515/clone-of-a-cinnabon/',
    ]
  },
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== AllRecipes Expansion ===\n');

  let totalAdded = 0;
  let totalFailed = 0;

  for (const batch of ALLRECIPES_BATCH) {
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
