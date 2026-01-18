#!/usr/bin/env node

/**
 * Catalog Expansion Script
 * Adds new collections and recipes to reach 250 recipes
 */

import {
  extractRecipe,
  loadCollection,
  saveCollection,
  createCollection,
  updateAllRecipesJson,
  addRecipeToCollection
} from './add-recipes.js';

// New collections to create
const NEW_COLLECTIONS = [
  {
    slug: 'mexican-favorites',
    name: 'Mexican Favorites',
    description: 'Authentic tacos, enchiladas, and vibrant Latin flavors'
  },
  {
    slug: 'italian-classics',
    name: 'Italian Classics',
    description: 'Pasta, risotto, and timeless dishes from Italy'
  },
  {
    slug: 'asian-inspired',
    name: 'Asian Inspired',
    description: 'Flavors from China, Japan, Thailand, Korea and beyond'
  },
  {
    slug: 'indian-cuisine',
    name: 'Indian Cuisine',
    description: 'Curries, biryanis, and aromatic spice-filled dishes'
  },
  {
    slug: 'mediterranean-mezze',
    name: 'Mediterranean & Mezze',
    description: 'Fresh, healthy dishes from Greece, Lebanon, and the Mediterranean'
  },
  {
    slug: 'soups-stews',
    name: 'Soups & Stews',
    description: 'Warming bowls for cozy days and easy meals'
  },
  {
    slug: 'desserts-sweets',
    name: 'Desserts & Sweets',
    description: 'Cakes, cookies, and sweet treats for any occasion'
  }
];

// Recipes to add by collection
// Format: { collection: 'slug', urls: [...], tags: [...] }
const RECIPES_TO_ADD = [
  // Mexican Favorites
  {
    collection: 'mexican-favorites',
    tags: ['mexican', 'latin'],
    urls: [
      'https://www.simplyrecipes.com/recipes/chicken_tacos/',
      'https://www.simplyrecipes.com/recipes/beef_tacos/',
      'https://www.simplyrecipes.com/recipes/carnitas/',
      'https://www.simplyrecipes.com/recipes/chicken_enchiladas/',
      'https://www.simplyrecipes.com/recipes/beef_enchiladas/',
      'https://www.recipetineats.com/chicken-quesadillas/',
      'https://www.simplyrecipes.com/recipes/guacamole/',
      'https://www.simplyrecipes.com/recipes/pico_de_gallo/',
      'https://www.simplyrecipes.com/recipes/refried_beans/',
      'https://www.simplyrecipes.com/recipes/mexican_rice/',
      'https://www.simplyrecipes.com/recipes/chicken_tortilla_soup/',
      'https://www.recipetineats.com/beef-burrito-bowls/',
      'https://www.simplyrecipes.com/recipes/fish_tacos/',
      'https://www.simplyrecipes.com/recipes/churros/',
      'https://www.simplyrecipes.com/recipes/tres_leches_cake/',
    ]
  },
  // Italian Classics
  {
    collection: 'italian-classics',
    tags: ['italian', 'pasta'],
    urls: [
      'https://www.simplyrecipes.com/recipes/spaghetti_carbonara/',
      'https://www.recipetineats.com/carbonara/',
      'https://www.simplyrecipes.com/recipes/fettuccine_alfredo/',
      'https://www.simplyrecipes.com/recipes/bolognese_sauce/',
      'https://www.simplyrecipes.com/recipes/pasta_primavera/',
      'https://www.simplyrecipes.com/recipes/chicken_parmesan/',
      'https://www.simplyrecipes.com/recipes/eggplant_parmesan/',
      'https://www.recipetineats.com/easy-risotto-recipe/',
      'https://www.simplyrecipes.com/recipes/minestrone_soup/',
      'https://www.simplyrecipes.com/recipes/bruschetta/',
      'https://www.simplyrecipes.com/recipes/caprese_salad/',
      'https://www.simplyrecipes.com/recipes/tiramisu/',
      'https://www.simplyrecipes.com/recipes/panna_cotta/',
      'https://www.simplyrecipes.com/recipes/pizza_dough/',
      'https://www.simplyrecipes.com/recipes/margherita_pizza/',
    ]
  },
  // Asian Inspired
  {
    collection: 'asian-inspired',
    tags: ['asian'],
    urls: [
      'https://www.recipetineats.com/chicken-chow-mein/',
      'https://www.recipetineats.com/beef-and-broccoli/',
      'https://www.recipetineats.com/kung-pao-chicken/',
      'https://www.recipetineats.com/sweet-and-sour-pork/',
      'https://www.recipetineats.com/general-tsos-chicken/',
      'https://www.recipetineats.com/japanese-chicken-katsu-curry/',
      'https://www.recipetineats.com/teriyaki-salmon/',
      'https://www.simplyrecipes.com/recipes/miso_soup/',
      'https://www.recipetineats.com/beef-pho/',
      'https://www.recipetineats.com/pad-see-ew/',
      'https://www.recipetineats.com/tom-yum-soup/',
      'https://www.recipetineats.com/korean-beef-bulgogi/',
      'https://www.recipetineats.com/bibimbap/',
      'https://www.simplyrecipes.com/recipes/pork_dumplings/',
      'https://www.recipetineats.com/spring-rolls/',
    ]
  },
  // Indian Cuisine
  {
    collection: 'indian-cuisine',
    tags: ['indian', 'curry'],
    urls: [
      'https://www.recipetineats.com/chicken-tikka-masala/',
      'https://www.recipetineats.com/butter-chicken/',
      'https://www.simplyrecipes.com/recipes/chicken_curry/',
      'https://www.recipetineats.com/lamb-rogan-josh/',
      'https://www.recipetineats.com/palak-paneer/',
      'https://www.simplyrecipes.com/recipes/chana_masala/',
      'https://www.recipetineats.com/dal-tadka/',
      'https://www.simplyrecipes.com/recipes/vegetable_korma/',
      'https://www.recipetineats.com/chicken-biryani/',
      'https://www.simplyrecipes.com/recipes/naan_bread/',
      'https://www.simplyrecipes.com/recipes/raita/',
      'https://www.recipetineats.com/samosas/',
      'https://www.simplyrecipes.com/recipes/aloo_gobi/',
      'https://www.recipetineats.com/tandoori-chicken/',
      'https://www.simplyrecipes.com/mango-lassi-recipe-5217019',
    ]
  },
  // Mediterranean & Mezze
  {
    collection: 'mediterranean-mezze',
    tags: ['mediterranean', 'healthy'],
    urls: [
      'https://www.simplyrecipes.com/recipes/hummus/',
      'https://www.simplyrecipes.com/recipes/baba_ganoush/',
      'https://www.simplyrecipes.com/recipes/falafel/',
      'https://www.simplyrecipes.com/recipes/tabbouleh/',
      'https://www.simplyrecipes.com/recipes/greek_salad/',
      'https://www.recipetineats.com/chicken-shawarma/',
      'https://www.recipetineats.com/lamb-kofta/',
      'https://www.simplyrecipes.com/recipes/tzatziki/',
      'https://www.simplyrecipes.com/recipes/moussaka/',
      'https://www.simplyrecipes.com/recipes/spanakopita/',
      'https://www.simplyrecipes.com/recipes/shakshuka/',
      'https://www.recipetineats.com/chicken-souvlaki/',
      'https://www.simplyrecipes.com/recipes/fattoush/',
      'https://www.simplyrecipes.com/recipes/baklava/',
      'https://www.simplyrecipes.com/recipes/lemon_chicken/',
    ]
  },
  // Soups & Stews
  {
    collection: 'soups-stews',
    tags: ['soup', 'stew', 'comfort'],
    urls: [
      'https://www.simplyrecipes.com/recipes/french_onion_soup/',
      'https://www.simplyrecipes.com/recipes/clam_chowder/',
      'https://www.simplyrecipes.com/recipes/split_pea_soup/',
      'https://www.simplyrecipes.com/recipes/lentil_soup/',
      'https://www.simplyrecipes.com/recipes/potato_leek_soup/',
      'https://www.simplyrecipes.com/recipes/broccoli_cheddar_soup/',
      'https://www.simplyrecipes.com/recipes/tortilla_soup/',
      'https://www.simplyrecipes.com/recipes/beef_barley_soup/',
      'https://www.recipetineats.com/irish-stew/',
      'https://www.simplyrecipes.com/recipes/gumbo/',
      'https://www.simplyrecipes.com/recipes/pozole_rojo/',
      'https://www.simplyrecipes.com/recipes/chicken_and_dumplings/',
      'https://www.recipetineats.com/moroccan-lamb-stew/',
      'https://www.simplyrecipes.com/recipes/gazpacho/',
      'https://www.simplyrecipes.com/recipes/cioppino/',
    ]
  },
  // Desserts & Sweets
  {
    collection: 'desserts-sweets',
    tags: ['dessert', 'sweet', 'baking'],
    urls: [
      'https://www.simplyrecipes.com/recipes/new_york_cheesecake/',
      'https://www.simplyrecipes.com/recipes/chocolate_mousse/',
      'https://www.simplyrecipes.com/recipes/creme_brulee/',
      'https://www.simplyrecipes.com/recipes/carrot_cake/',
      'https://www.simplyrecipes.com/recipes/red_velvet_cake/',
      'https://www.simplyrecipes.com/recipes/pecan_pie/',
      'https://www.simplyrecipes.com/recipes/key_lime_pie/',
      'https://www.simplyrecipes.com/recipes/bread_pudding/',
      'https://www.simplyrecipes.com/recipes/rice_pudding/',
      'https://www.simplyrecipes.com/recipes/chocolate_lava_cake/',
      'https://www.simplyrecipes.com/recipes/peanut_butter_cookies/',
      'https://www.simplyrecipes.com/recipes/snickerdoodles/',
      'https://www.simplyrecipes.com/recipes/oatmeal_raisin_cookies/',
      'https://www.simplyrecipes.com/recipes/macarons/',
      'https://www.simplyrecipes.com/recipes/strawberry_shortcake/',
    ]
  },
  // Beef up existing collections
  {
    collection: 'quick-weeknight-dinners',
    tags: ['quick', 'easy', 'weeknight'],
    urls: [
      'https://www.recipetineats.com/honey-garlic-chicken/',
      'https://www.recipetineats.com/garlic-butter-shrimp/',
      'https://www.simplyrecipes.com/recipes/sheet_pan_fajitas/',
      'https://www.recipetineats.com/one-pan-chicken-thighs-with-lemon-herb-rice/',
      'https://www.simplyrecipes.com/recipes/easy_pork_chops/',
    ]
  },
  {
    collection: 'comfort-food-classics',
    tags: ['comfort', 'classic', 'hearty'],
    urls: [
      'https://www.simplyrecipes.com/recipes/shepherds_pie/',
      'https://www.simplyrecipes.com/recipes/pot_roast/',
      'https://www.simplyrecipes.com/recipes/tuna_casserole/',
      'https://www.simplyrecipes.com/recipes/mashed_potatoes/',
      'https://www.simplyrecipes.com/recipes/gravy/',
    ]
  },
  {
    collection: 'breakfast-brunch',
    tags: ['breakfast', 'brunch'],
    urls: [
      'https://www.simplyrecipes.com/recipes/shakshuka/',
      'https://www.simplyrecipes.com/recipes/banana_pancakes/',
      'https://www.simplyrecipes.com/recipes/avocado_toast/',
      'https://www.simplyrecipes.com/recipes/hash_browns/',
      'https://www.simplyrecipes.com/recipes/blueberry_pancakes/',
    ]
  },
  {
    collection: 'grilling-bbq',
    tags: ['grilling', 'bbq', 'summer'],
    urls: [
      'https://www.simplyrecipes.com/recipes/grilled_salmon/',
      'https://www.simplyrecipes.com/recipes/beer_can_chicken/',
      'https://www.simplyrecipes.com/recipes/bbq_chicken/',
      'https://www.simplyrecipes.com/recipes/grilled_corn_on_the_cob/',
      'https://www.simplyrecipes.com/recipes/grilled_zucchini/',
    ]
  },
  {
    collection: 'vegetarian-mains',
    tags: ['vegetarian', 'meatless'],
    urls: [
      'https://www.simplyrecipes.com/recipes/stuffed_peppers/',
      'https://www.simplyrecipes.com/recipes/ratatouille/',
      'https://www.simplyrecipes.com/recipes/vegetable_lasagna/',
      'https://www.simplyrecipes.com/recipes/black_bean_burgers/',
      'https://www.simplyrecipes.com/recipes/cheese_souffle/',
    ]
  },
  {
    collection: 'appetizers-party',
    tags: ['appetizer', 'party', 'snack'],
    urls: [
      'https://www.simplyrecipes.com/recipes/pigs_in_a_blanket/',
      'https://www.simplyrecipes.com/recipes/cheese_ball/',
      'https://www.simplyrecipes.com/recipes/stuffed_mushrooms/',
      'https://www.simplyrecipes.com/recipes/bruschetta/',
      'https://www.simplyrecipes.com/recipes/shrimp_cocktail/',
    ]
  },
  {
    collection: 'healthy-lunches',
    tags: ['healthy', 'lunch', 'light'],
    urls: [
      'https://www.simplyrecipes.com/recipes/chicken_caesar_salad/',
      'https://www.simplyrecipes.com/recipes/asian_chicken_salad/',
      'https://www.simplyrecipes.com/recipes/nicoise_salad/',
      'https://www.simplyrecipes.com/recipes/cobb_salad/',
      'https://www.simplyrecipes.com/recipes/southwest_chicken_salad/',
    ]
  },
  {
    collection: 'one-pot-meals',
    tags: ['one-pot', 'easy', 'minimal-cleanup'],
    urls: [
      'https://www.recipetineats.com/one-pot-chicken-burrito-bowls/',
      'https://www.simplyrecipes.com/recipes/jambalaya/',
      'https://www.simplyrecipes.com/recipes/shrimp_and_grits/',
      'https://www.simplyrecipes.com/recipes/red_beans_and_rice/',
      'https://www.recipetineats.com/one-pot-beef-stroganoff/',
    ]
  },
  {
    collection: 'baking-basics',
    tags: ['baking', 'dessert'],
    urls: [
      'https://www.simplyrecipes.com/recipes/pound_cake/',
      'https://www.simplyrecipes.com/recipes/angel_food_cake/',
      'https://www.simplyrecipes.com/recipes/scones/',
      'https://www.simplyrecipes.com/recipes/biscuits/',
      'https://www.simplyrecipes.com/recipes/pie_crust/',
    ]
  }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Simpler Recipes Catalog Expansion ===\n');

  // Step 1: Create new collections
  console.log('Step 1: Creating new collections...\n');
  for (const coll of NEW_COLLECTIONS) {
    const existing = loadCollection(coll.slug);
    if (existing) {
      console.log(`  Collection exists: ${coll.name}`);
    } else {
      const newColl = createCollection(coll.slug, coll.name, coll.description);
      saveCollection(newColl);
      console.log(`  Created: ${coll.name}`);
    }
  }

  // Step 2: Add recipes to collections
  console.log('\nStep 2: Adding recipes to collections...\n');

  let totalAdded = 0;
  let totalFailed = 0;

  for (const batch of RECIPES_TO_ADD) {
    console.log(`\n--- ${batch.collection} ---`);

    for (const url of batch.urls) {
      try {
        const result = await addRecipeToCollection(url, batch.collection, batch.tags);
        if (result) {
          totalAdded++;
        }
        // Rate limit to avoid being blocked
        await sleep(1500);
      } catch (error) {
        console.error(`  Failed: ${url} - ${error.message}`);
        totalFailed++;
      }
    }
  }

  // Step 3: Update all-recipes.json
  console.log('\nStep 3: Updating master recipe index...\n');
  updateAllRecipesJson();

  console.log('\n=== Expansion Complete ===');
  console.log(`Added: ${totalAdded} recipes`);
  console.log(`Failed: ${totalFailed} recipes`);
}

main().catch(console.error);
