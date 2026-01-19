/**
 * Ingredient Parser - Tier 2 (Enhanced)
 * Parses ingredient strings into structured data
 * Includes unit conversion and fuzzy matching
 */

// Common units and their normalizations
const UNIT_MAP = {
  // Volume
  'cup': 'cup',
  'cups': 'cup',
  'c': 'cup',
  'tablespoon': 'tbsp',
  'tablespoons': 'tbsp',
  'tbsp': 'tbsp',
  'tbs': 'tbsp',
  'tb': 'tbsp',
  'T': 'tbsp',
  'teaspoon': 'tsp',
  'teaspoons': 'tsp',
  'tsp': 'tsp',
  't': 'tsp',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  'fl oz': 'fl oz',
  'pint': 'pint',
  'pints': 'pint',
  'pt': 'pint',
  'quart': 'quart',
  'quarts': 'quart',
  'qt': 'quart',
  'gallon': 'gallon',
  'gallons': 'gallon',
  'gal': 'gallon',
  'milliliter': 'ml',
  'milliliters': 'ml',
  'ml': 'ml',
  'liter': 'L',
  'liters': 'L',
  'l': 'L',
  'L': 'L',

  // Weight
  'pound': 'lb',
  'pounds': 'lb',
  'lb': 'lb',
  'lbs': 'lb',
  'ounce': 'oz',
  'ounces': 'oz',
  'oz': 'oz',
  'gram': 'g',
  'grams': 'g',
  'g': 'g',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'kg': 'kg',

  // Count
  'piece': 'piece',
  'pieces': 'piece',
  'slice': 'slice',
  'slices': 'slice',
  'clove': 'clove',
  'cloves': 'clove',
  'head': 'head',
  'heads': 'head',
  'bunch': 'bunch',
  'bunches': 'bunch',
  'sprig': 'sprig',
  'sprigs': 'sprig',
  'stalk': 'stalk',
  'stalks': 'stalk',
  'can': 'can',
  'cans': 'can',
  'jar': 'jar',
  'jars': 'jar',
  'package': 'package',
  'packages': 'package',
  'pkg': 'package',
  'bag': 'bag',
  'bags': 'bag',
  'box': 'box',
  'boxes': 'box',
  'stick': 'stick',
  'sticks': 'stick',
  'pinch': 'pinch',
  'pinches': 'pinch',
  'dash': 'dash',
  'dashes': 'dash',

  // Size indicators (often used without explicit units)
  'small': 'small',
  'medium': 'medium',
  'med': 'medium',
  'large': 'large',
  'lg': 'large',
};

// Fraction map for converting text fractions
const FRACTION_MAP = {
  '½': 0.5,
  '⅓': 0.333,
  '⅔': 0.667,
  '¼': 0.25,
  '¾': 0.75,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 0.167,
  '⅚': 0.833,
};

// Grocery categories for organization
const CATEGORY_KEYWORDS = {
  'produce': [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'avocado', 'tomato', 'potato',
    'onion', 'garlic', 'ginger', 'carrot', 'celery', 'lettuce', 'spinach', 'kale',
    'broccoli', 'cauliflower', 'pepper', 'cucumber', 'zucchini', 'squash', 'mushroom',
    'corn', 'peas', 'beans', 'cilantro', 'parsley', 'basil', 'mint', 'rosemary',
    'thyme', 'oregano', 'sage', 'dill', 'chives', 'scallion', 'shallot', 'leek',
    'cabbage', 'asparagus', 'artichoke', 'beet', 'radish', 'turnip', 'eggplant',
    'jalapeño', 'serrano', 'habanero', 'berry', 'strawberry', 'blueberry', 'raspberry',
    'grape', 'melon', 'watermelon', 'cantaloupe', 'peach', 'plum', 'nectarine',
    'mango', 'pineapple', 'papaya', 'kiwi', 'pear', 'cherry', 'coconut', 'fig',
    'date', 'pomegranate', 'grapefruit', 'tangerine', 'clementine', 'arugula',
    'chard', 'collard', 'endive', 'fennel', 'bok choy', 'green onion', 'fresh'
  ],
  'meat': [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'bacon', 'sausage',
    'ham', 'steak', 'ground beef', 'ground turkey', 'ground pork', 'ribs',
    'brisket', 'tenderloin', 'sirloin', 'ribeye', 'drumstick', 'thigh', 'breast',
    'wing', 'chorizo', 'prosciutto', 'pancetta', 'salami', 'pepperoni', 'veal',
    'venison', 'bison', 'goat', 'rabbit', 'liver', 'hot dog', 'meatball'
  ],
  'seafood': [
    'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout', 'bass',
    'snapper', 'mahi', 'swordfish', 'shrimp', 'prawn', 'lobster', 'crab',
    'scallop', 'clam', 'mussel', 'oyster', 'squid', 'calamari', 'octopus',
    'anchovy', 'sardine', 'mackerel', 'catfish', 'sole', 'flounder'
  ],
  'dairy': [
    'milk', 'cream', 'butter', 'cheese', 'yogurt', 'sour cream', 'cottage cheese',
    'cream cheese', 'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'feta',
    'gouda', 'brie', 'swiss', 'provolone', 'goat cheese', 'blue cheese',
    'half and half', 'half-and-half', 'whipping cream', 'heavy cream', 'egg',
    'eggs', 'buttermilk', 'ghee', 'mascarpone', 'gruyere', 'manchego'
  ],
  'bakery': [
    'bread', 'bagel', 'croissant', 'muffin', 'roll', 'bun', 'tortilla', 'pita',
    'naan', 'baguette', 'ciabatta', 'sourdough', 'focaccia', 'brioche', 'english muffin',
    'flatbread', 'crouton', 'breadcrumb', 'panko', 'cake', 'pie crust', 'pastry'
  ],
  'pantry': [
    'flour', 'sugar', 'salt', 'pepper', 'oil', 'olive oil', 'vegetable oil',
    'canola oil', 'coconut oil', 'sesame oil', 'vinegar', 'soy sauce', 'fish sauce',
    'worcestershire', 'hot sauce', 'sriracha', 'ketchup', 'mustard', 'mayonnaise',
    'honey', 'maple syrup', 'molasses', 'vanilla', 'baking soda', 'baking powder',
    'yeast', 'cornstarch', 'cocoa', 'chocolate', 'rice', 'pasta', 'noodle',
    'quinoa', 'couscous', 'oats', 'cereal', 'granola', 'nut', 'almond', 'walnut',
    'pecan', 'cashew', 'peanut', 'pistachio', 'seed', 'sesame', 'sunflower',
    'pumpkin seed', 'chia', 'flax', 'broth', 'stock', 'bouillon', 'tomato paste',
    'tomato sauce', 'canned tomato', 'diced tomato', 'crushed tomato', 'bean',
    'chickpea', 'lentil', 'black bean', 'kidney bean', 'pinto bean', 'white bean',
    'dried', 'canned', 'jarred', 'spice', 'cumin', 'paprika', 'cinnamon',
    'nutmeg', 'cayenne', 'chili powder', 'curry', 'turmeric', 'coriander',
    'cardamom', 'clove', 'allspice', 'bay leaf', 'extract', 'sauce', 'paste'
  ],
  'frozen': [
    'frozen', 'ice cream', 'sorbet', 'gelato', 'popsicle', 'frozen pizza',
    'frozen vegetable', 'frozen fruit', 'frozen dinner', 'frozen fries'
  ],
  'beverages': [
    'water', 'juice', 'soda', 'coffee', 'tea', 'wine', 'beer', 'liquor',
    'vodka', 'rum', 'whiskey', 'tequila', 'gin', 'brandy', 'champagne',
    'sparkling', 'coconut water', 'almond milk', 'oat milk', 'soy milk'
  ],
  'other': [] // Default category
};

// Unit conversion factors (to a base unit within each type)
// Volume: base unit is tsp
// Weight: base unit is oz
const UNIT_CONVERSIONS = {
  // Volume conversions (to tsp)
  'tsp': { type: 'volume', toBase: 1, fromBase: 1 },
  'tbsp': { type: 'volume', toBase: 3, fromBase: 1/3 },
  'fl oz': { type: 'volume', toBase: 6, fromBase: 1/6 },
  'cup': { type: 'volume', toBase: 48, fromBase: 1/48 },
  'pint': { type: 'volume', toBase: 96, fromBase: 1/96 },
  'quart': { type: 'volume', toBase: 192, fromBase: 1/192 },
  'gallon': { type: 'volume', toBase: 768, fromBase: 1/768 },
  'ml': { type: 'volume', toBase: 0.2029, fromBase: 4.929 },
  'L': { type: 'volume', toBase: 202.9, fromBase: 0.004929 },

  // Weight conversions (to oz)
  'oz': { type: 'weight', toBase: 1, fromBase: 1 },
  'lb': { type: 'weight', toBase: 16, fromBase: 1/16 },
  'g': { type: 'weight', toBase: 0.03527, fromBase: 28.35 },
  'kg': { type: 'weight', toBase: 35.27, fromBase: 0.02835 },
};

// Preferred display units (when converting, prefer these)
const PREFERRED_UNITS = {
  volume: ['cup', 'tbsp', 'tsp'],
  weight: ['lb', 'oz']
};

// Common ingredient name variations for fuzzy matching
const INGREDIENT_ALIASES = {
  // Proteins
  'chicken breast': ['chicken breasts', 'boneless chicken breast', 'skinless chicken breast', 'boneless skinless chicken breast'],
  'chicken thigh': ['chicken thighs', 'boneless chicken thigh', 'chicken thigh meat'],
  'ground beef': ['beef mince', 'minced beef', 'hamburger meat'],
  'ground turkey': ['turkey mince', 'minced turkey'],
  'bacon': ['bacon strips', 'bacon slices', 'streaky bacon'],

  // Dairy
  'butter': ['unsalted butter', 'salted butter'],
  'milk': ['whole milk', '2% milk', 'skim milk'],
  'heavy cream': ['whipping cream', 'heavy whipping cream', 'double cream'],
  'sour cream': ['sourcream'],
  'cream cheese': ['philadelphia', 'philly cream cheese'],
  'parmesan': ['parmesan cheese', 'parmigiano', 'parmigiano reggiano', 'grated parmesan'],
  'mozzarella': ['mozzarella cheese', 'fresh mozzarella'],
  'cheddar': ['cheddar cheese', 'sharp cheddar', 'mild cheddar'],

  // Produce
  'garlic': ['garlic cloves', 'cloves garlic', 'fresh garlic'],
  'onion': ['yellow onion', 'white onion', 'brown onion'],
  'red onion': ['purple onion'],
  'green onion': ['scallion', 'scallions', 'spring onion', 'spring onions'],
  'bell pepper': ['capsicum', 'sweet pepper'],
  'tomato': ['tomatoes', 'fresh tomato', 'fresh tomatoes'],
  'potato': ['potatoes', 'white potato', 'russet potato'],
  'lemon juice': ['juice of lemon', 'fresh lemon juice'],
  'lime juice': ['juice of lime', 'fresh lime juice'],
  'cilantro': ['fresh cilantro', 'coriander leaves', 'fresh coriander'],
  'parsley': ['fresh parsley', 'flat leaf parsley', 'italian parsley'],

  // Pantry
  'olive oil': ['extra virgin olive oil', 'evoo', 'light olive oil'],
  'vegetable oil': ['canola oil', 'neutral oil', 'cooking oil'],
  'soy sauce': ['soya sauce', 'shoyu'],
  'all-purpose flour': ['ap flour', 'plain flour', 'white flour', 'flour'],
  'brown sugar': ['light brown sugar', 'dark brown sugar', 'packed brown sugar'],
  'white sugar': ['granulated sugar', 'sugar', 'caster sugar'],
  'powdered sugar': ['confectioners sugar', 'icing sugar'],
  'baking powder': ['baking pwdr'],
  'baking soda': ['bicarbonate of soda', 'bicarb'],
  'vanilla extract': ['vanilla', 'pure vanilla extract'],
  'chicken broth': ['chicken stock', 'chicken bouillon'],
  'beef broth': ['beef stock', 'beef bouillon'],
  'vegetable broth': ['vegetable stock', 'veggie broth'],
};

// Build reverse lookup for aliases
const ALIAS_TO_CANONICAL = {};
for (const [canonical, aliases] of Object.entries(INGREDIENT_ALIASES)) {
  ALIAS_TO_CANONICAL[canonical.toLowerCase()] = canonical;
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL[alias.toLowerCase()] = canonical;
  }
}

/**
 * Parse a number from a string, handling fractions and mixed numbers
 * @param {string} str - The string to parse
 * @returns {number|null} The parsed number or null
 */
function parseQuantity(str) {
  if (!str) return null;

  str = str.trim();

  // Check for unicode fractions
  for (const [frac, val] of Object.entries(FRACTION_MAP)) {
    if (str.includes(frac)) {
      // Handle mixed numbers like "1½"
      const parts = str.split(frac);
      const whole = parts[0] ? parseFloat(parts[0]) || 0 : 0;
      return whole + val;
    }
  }

  // Handle text fractions like "1/2"
  const fractionMatch = str.match(/^(\d+)?\s*(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const whole = fractionMatch[1] ? parseInt(fractionMatch[1]) : 0;
    const num = parseInt(fractionMatch[2]);
    const denom = parseInt(fractionMatch[3]);
    return whole + (num / denom);
  }

  // Handle ranges like "2-3" - take the average
  const rangeMatch = str.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  }

  // Try direct parse
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Normalize a unit string
 * @param {string} unit - The unit to normalize
 * @returns {string|null} The normalized unit or null
 */
function normalizeUnit(unit) {
  if (!unit) return null;
  const lower = unit.toLowerCase().trim();
  return UNIT_MAP[lower] || lower;
}

/**
 * Determine the grocery category for an ingredient
 * @param {string} name - The ingredient name
 * @returns {string} The category
 */
function categorize(name) {
  const lower = name.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }

  return 'other';
}

/**
 * Clean up ingredient name by removing quantities, units, and prep instructions
 * @param {string} name - The raw ingredient name
 * @returns {string} The cleaned name
 */
function cleanName(name) {
  if (!name) return '';

  // Remove leading/trailing whitespace
  name = name.trim();

  // Remove common prep instructions in parentheses
  name = name.replace(/\s*\([^)]*\)\s*/g, ' ');

  // Remove trailing prep instructions after comma
  name = name.replace(/,\s*(chopped|diced|minced|sliced|grated|shredded|crushed|melted|softened|cubed|julienned|torn|beaten|whisked|divided|optional|to taste|for garnish|for serving|plus more|or more|or less|room temperature|at room temperature).*$/i, '');

  // Clean up whitespace
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}

/**
 * Parse a single ingredient string into structured data
 * @param {string} ingredientStr - The raw ingredient string (e.g., "2 cups flour, sifted")
 * @returns {Object} Parsed ingredient object
 */
export function parseIngredient(ingredientStr) {
  if (!ingredientStr || typeof ingredientStr !== 'string') {
    return {
      original: ingredientStr || '',
      quantity: null,
      unit: null,
      name: ingredientStr || '',
      category: 'other',
      notes: null
    };
  }

  const original = ingredientStr.trim();
  let remaining = original;

  // Extract notes in parentheses first
  let notes = null;
  const notesMatch = remaining.match(/\(([^)]+)\)/);
  if (notesMatch) {
    notes = notesMatch[1];
    remaining = remaining.replace(/\s*\([^)]+\)\s*/g, ' ').trim();
  }

  // Build regex for quantity (handles unicode fractions, regular fractions, decimals, ranges)
  const fractionChars = Object.keys(FRACTION_MAP).join('');
  const quantityPattern = `^([\\d${fractionChars}]+(?:\\s*[\\d/]+)?(?:\\s*[-–]\\s*[\\d${fractionChars}]+(?:\\s*[\\d/]+)?)?)`;

  // Extract quantity
  let quantity = null;
  const quantityMatch = remaining.match(new RegExp(quantityPattern));
  if (quantityMatch) {
    quantity = parseQuantity(quantityMatch[1]);
    remaining = remaining.slice(quantityMatch[0].length).trim();
  }

  // Build unit pattern from our map
  const unitWords = Object.keys(UNIT_MAP).sort((a, b) => b.length - a.length);
  const unitPattern = `^(${unitWords.join('|')})\\.?\\s+`;

  // Extract unit
  let unit = null;
  const unitMatch = remaining.match(new RegExp(unitPattern, 'i'));
  if (unitMatch) {
    unit = normalizeUnit(unitMatch[1]);
    remaining = remaining.slice(unitMatch[0].length).trim();
  }

  // Handle "of" after unit (e.g., "2 cups of flour")
  remaining = remaining.replace(/^of\s+/i, '');

  // The rest is the ingredient name
  const name = cleanName(remaining);

  return {
    original,
    quantity,
    unit,
    name,
    category: categorize(name),
    notes
  };
}

/**
 * Parse multiple ingredient strings
 * @param {string[]} ingredients - Array of ingredient strings
 * @returns {Object[]} Array of parsed ingredients
 */
export function parseIngredients(ingredients) {
  if (!Array.isArray(ingredients)) return [];
  return ingredients.map(parseIngredient);
}

/**
 * Normalize an ingredient name using alias lookup and cleanup
 * @param {string} name - The ingredient name
 * @returns {string} The canonical name
 */
export function normalizeIngredientName(name) {
  if (!name) return '';

  // Clean and lowercase
  let normalized = name.toLowerCase().trim();

  // Remove trailing 's' for simple plurals (but not words ending in 'ss')
  if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
    const singular = normalized.slice(0, -1);
    // Check if singular form exists in aliases
    if (ALIAS_TO_CANONICAL[singular]) {
      normalized = singular;
    }
  }

  // Check for exact alias match
  if (ALIAS_TO_CANONICAL[normalized]) {
    return ALIAS_TO_CANONICAL[normalized];
  }

  // Check for partial matches (e.g., "fresh garlic cloves" should match "garlic")
  for (const [alias, canonical] of Object.entries(ALIAS_TO_CANONICAL)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      // Prefer longer matches
      if (alias.length >= 4) {
        return canonical;
      }
    }
  }

  return name.trim();
}

/**
 * Check if two units are compatible (same type)
 * @param {string} unit1
 * @param {string} unit2
 * @returns {boolean}
 */
export function areUnitsCompatible(unit1, unit2) {
  if (!unit1 || !unit2) return false;
  if (unit1 === unit2) return true;

  const conv1 = UNIT_CONVERSIONS[unit1];
  const conv2 = UNIT_CONVERSIONS[unit2];

  if (!conv1 || !conv2) return false;
  return conv1.type === conv2.type;
}

/**
 * Convert a quantity from one unit to another
 * @param {number} quantity
 * @param {string} fromUnit
 * @param {string} toUnit
 * @returns {number|null} Converted quantity or null if incompatible
 */
export function convertUnit(quantity, fromUnit, toUnit) {
  if (quantity === null || quantity === undefined) return null;
  if (fromUnit === toUnit) return quantity;

  const fromConv = UNIT_CONVERSIONS[fromUnit];
  const toConv = UNIT_CONVERSIONS[toUnit];

  if (!fromConv || !toConv) return null;
  if (fromConv.type !== toConv.type) return null;

  // Convert to base unit, then to target unit
  const inBase = quantity * fromConv.toBase;
  return inBase * toConv.fromBase;
}

/**
 * Find the best display unit for a quantity
 * @param {number} quantity - Quantity in base units
 * @param {string} unitType - 'volume' or 'weight'
 * @returns {{ quantity: number, unit: string }}
 */
function findBestUnit(quantity, unitType) {
  const preferred = PREFERRED_UNITS[unitType] || [];

  for (const unit of preferred) {
    const conv = UNIT_CONVERSIONS[unit];
    if (!conv) continue;

    const converted = quantity * conv.fromBase;

    // Check if this gives a reasonable number (between 0.25 and 100)
    if (converted >= 0.25 && converted <= 100) {
      return { quantity: converted, unit };
    }
  }

  // Default to the smallest preferred unit
  const defaultUnit = preferred[preferred.length - 1] || 'tsp';
  const conv = UNIT_CONVERSIONS[defaultUnit];
  return {
    quantity: conv ? quantity * conv.fromBase : quantity,
    unit: defaultUnit
  };
}

/**
 * Add two quantities, converting units if needed
 * @param {number|null} qty1
 * @param {string|null} unit1
 * @param {number|null} qty2
 * @param {string|null} unit2
 * @returns {{ quantity: number|null, unit: string|null }}
 */
export function addQuantities(qty1, unit1, qty2, unit2) {
  // Handle null cases
  if (qty1 === null && qty2 === null) return { quantity: null, unit: null };
  if (qty1 === null) return { quantity: qty2, unit: unit2 };
  if (qty2 === null) return { quantity: qty1, unit: unit1 };

  // Same unit - simple addition
  if (unit1 === unit2) {
    return { quantity: qty1 + qty2, unit: unit1 };
  }

  // No units - simple addition
  if (!unit1 && !unit2) {
    return { quantity: qty1 + qty2, unit: null };
  }

  // One has unit, one doesn't - can't combine properly
  if (!unit1 || !unit2) {
    // Keep the one with a unit, add the other as-is
    return { quantity: qty1 + qty2, unit: unit1 || unit2 };
  }

  // Check if units are compatible
  const conv1 = UNIT_CONVERSIONS[unit1];
  const conv2 = UNIT_CONVERSIONS[unit2];

  if (!conv1 || !conv2 || conv1.type !== conv2.type) {
    // Incompatible units - keep the larger quantity's unit
    return qty1 >= qty2
      ? { quantity: qty1, unit: unit1 }
      : { quantity: qty2, unit: unit2 };
  }

  // Convert both to base, add, then find best display unit
  const base1 = qty1 * conv1.toBase;
  const base2 = qty2 * conv2.toBase;
  const totalBase = base1 + base2;

  return findBestUnit(totalBase, conv1.type);
}

/**
 * Calculate string similarity (Dice coefficient)
 * @param {string} s1
 * @param {string} s2
 * @returns {number} 0-1 similarity score
 */
function stringSimilarity(s1, s2) {
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Set();
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2));
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    if (bigrams1.has(bigram)) {
      intersection++;
      bigrams1.delete(bigram); // Count each match only once
    }
  }

  return (2 * intersection) / (s1.length - 1 + s2.length - 1);
}

/**
 * Check if two ingredient names are similar enough to merge
 * @param {string} name1
 * @param {string} name2
 * @returns {boolean}
 */
export function areIngredientsSimilar(name1, name2) {
  const n1 = normalizeIngredientName(name1).toLowerCase();
  const n2 = normalizeIngredientName(name2).toLowerCase();

  // Exact match after normalization
  if (n1 === n2) return true;

  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // High string similarity
  if (stringSimilarity(n1, n2) > 0.8) return true;

  return false;
}

/**
 * Create a normalized key for merging similar ingredients
 * @param {Object} parsed - A parsed ingredient object
 * @returns {string} A key for grouping/merging
 */
export function getIngredientKey(parsed) {
  // Use canonical name for grouping
  const canonicalName = normalizeIngredientName(parsed.name);
  const normalizedName = canonicalName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Get unit type for grouping (compatible units can be merged)
  const conv = UNIT_CONVERSIONS[parsed.unit];
  const unitType = conv ? conv.type : (parsed.unit || 'count');

  return `${normalizedName}|${unitType}`;
}

/**
 * Merge two quantities with the same unit
 * @param {number|null} qty1
 * @param {number|null} qty2
 * @returns {number|null}
 */
export function mergeQuantities(qty1, qty2) {
  if (qty1 === null && qty2 === null) return null;
  if (qty1 === null) return qty2;
  if (qty2 === null) return qty1;
  return qty1 + qty2;
}

/**
 * Format a parsed ingredient back to a display string
 * @param {Object} parsed - A parsed ingredient object
 * @returns {string} Formatted string
 */
export function formatIngredient(parsed) {
  const parts = [];

  if (parsed.quantity !== null) {
    // Format quantity nicely
    if (Number.isInteger(parsed.quantity)) {
      parts.push(parsed.quantity.toString());
    } else {
      // Round to 2 decimal places and remove trailing zeros
      parts.push(parseFloat(parsed.quantity.toFixed(2)).toString());
    }
  }

  if (parsed.unit) {
    parts.push(parsed.unit);
  }

  if (parsed.name) {
    parts.push(parsed.name);
  }

  return parts.join(' ');
}
