/**
 * The rule behind the "Empty-Fridge Cooking" browse page.
 *
 * A recipe qualifies only if EVERY ingredient is shelf-stable, frozen, or a long-keeper most
 * kitchens already have (onions, garlic, potatoes, carrots, eggs, butter, hard cheese, bread).
 * Anything fresh and perishable — fresh meat or fish, fresh herbs, salad leaves, cream — fails
 * the whole recipe, and so does any ingredient the rule doesn't recognise.
 *
 * Failing CLOSED on unknowns is deliberate. The page's entire promise is "you can cook this
 * tonight without shopping", so a wrong inclusion is far more damaging than a missed recipe.
 * That also makes the claim testable rather than decorative — see tests/pantry.test.ts.
 *
 * Note that "dried", "fresh", "frozen" and "canned" are NOT stripped: they are the signal that
 * separates a pantry herb from a perishable one.
 */

/** Strip amounts, units and prep notes, but keep words that indicate how a food is stored. */
export function foodOf(line: string): string {
  return line
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+([.,/]\d+)?\b|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛]/g, ' ')
    .replace(/\b(cups?|tbsp|tablespoons?|tsp|teaspoons?|ounces?|oz|pounds?|lbs?|lb|grams?|g|kg|ml|l|litres?|liters?|quarts?|pints?|packages?|pkg|packets?|boxes?|box|bags?|containers?|slices?|pieces?|medium|large|small|whole|halves?|half|inch|pinch|dash|bunch|to taste|optional|divided|drained|rinsed|thawed|undrained|chopped|diced|minced|sliced|shredded|grated|crushed|finely|roughly|cut|into|seeded|peeled|of|or|and|plus|extra|for|serving|choice|about)\b/g, ' ')
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fresh/perishable markers — any hit disqualifies the recipe. */
const PERISHABLE: RegExp[] = [
  // proteins (raw/fresh); canned versions are allowed separately below
  /\b(chickens?|turkeys?|beef|pork|lamb|steaks?|chops?|roasts?|sausages?|bacon|hams?|minces?|drumsticks?|thighs?|breasts?|fillets?|cutlets?|ribs?)\b/,
  /\b(fish|salmon|cod|tilapia|snapper|barramundi|shrimps?|prawns?|crabs?|scallops?|mussels?|squid)\b/,
  // fresh produce that does not keep
  /\b(lettuces?|romaine|rocket|arugula|spinach|kale|cabbages?|celery|cucumbers?|zucchinis?|courgettes?|squash|broccoli|cauliflower|asparagus|capsicums?|peppers? (red|green|yellow)|mushrooms?|avocados?|eggplants?|aubergines?|tomatoes fresh|snow peas|beans green|bok choy|pak choy|silverbeet|leeks?|shallots?|spring onions?)\b/,
  /\bfresh\b/,
  /\b(coriander|cilantro|parsley|basil|mint|dill|chives|rosemary|thyme|sage|oregano leaves)\b(?!.*dried)/,
  // dairy that spoils quickly
  /\b(creams?|half and half|sour cream|yogh?urts?|buttermilk|cream cheese|ricotta|cottage cheese|custard)\b/,
  // fresh fruit
  /\b(bananas?|apples?|oranges?|lemons?|limes?|berries|berry|strawberr\w*|blueberr\w*|raspberr\w*|grapes?|melons?|peaches?|pears?|mangoes?|mango|pineapples?|kiwis?)\b/,
  /\b(tofu|baguettes?)\b/,
];

/** Shelf-stable, frozen, or long-keeping. */
const PANTRY: RegExp[] = [
  /\b(canned|tinned|can|tin|jar|frozen|dried|dry|instant|powdered)\b/,
  /\b(tomatoes?|tomato sauce|tomato paste|passata|salsa|beans?|kidney|pinto|garbanzo|chickpeas?|lentils?|split peas?|corn|peas|chilies|chiles|olives|pickles?|artichokes?|pumpkin|applesauce|broths?|stocks?|bouillon|coconut milk|evaporated milk|condensed)\b/,
  /\b(tuna|sardines?|anchovy|anchovies)\b/,
  /\b(rice|pastas?|spaghetti|macaroni|noodles?|couscous|quinoa|barley|oats?|oatmeal|cornmeal|polenta|grits|flours?|wholemeal|wholegrain|tortillas?|breads?|breadcrumbs?|crackers?|cereals?|bulgur|semolina)\b/,
  /\b(oils?|vinegars?|soy sauce|oyster sauce|fish sauce|hot sauce|worcestershire|mustard|ketchup|mayonnaise|honey|syrups?|sugars?|icing|molasses|jams?|jelly|peanut butter|vegemite|marmite|cornflour|cornstarch|custard powder|cocoa|chocolate)\b/,
  /\b(salt|peppers?|black pepper|chilli|chili|cumin|paprika|turmeric|coriander seeds?|garam masala|curry|cinnamon|nutmeg|ginger|cayenne|herbs?|seasonings?|spices?|stock cubes?|vanilla|baking powder|baking soda|yeast|nuts?|almonds?|walnuts?|pecans?|cashews?|peanuts?|raisins?|sultanas?|currants?|dates|seeds?|coconut)\b/,
  /\b(onions?|garlic|potatoes?|potato|kumara|sweet potatoes?|carrots?|butternut|swede|turnips?|parsnips?)\b/,
  /\b(eggs?|butter|margarine|milk|cheeses?|cheddar|parmesan|mozzarella|feta)\b/,
  /\b(water|ice)\b/,
];

export interface PantryVerdict { ok: boolean; offenders: string[]; unknown: string[] }

export function checkPantry(ingredients: string[]): PantryVerdict {
  const offenders: string[] = [];
  const unknown: string[] = [];
  for (const line of ingredients) {
    const food = foodOf(line);
    if (!food) continue;
    if (PERISHABLE.some((re) => re.test(food))) { offenders.push(line); continue; }
    if (!PANTRY.some((re) => re.test(food))) unknown.push(line);
  }
  return { ok: offenders.length === 0 && unknown.length === 0, offenders, unknown };
}
