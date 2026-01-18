/**
 * Measurement conversion utility for cooking measurements
 * Converts between imperial and metric units
 */

// Unicode fractions for parsing
const UNICODE_TO_DECIMAL = {
  '\u215B': 0.125, // ⅛
  '\u00BC': 0.25,  // ¼
  '\u2153': 0.333, // ⅓
  '\u215C': 0.375, // ⅜
  '\u00BD': 0.5,   // ½
  '\u215D': 0.625, // ⅝
  '\u2154': 0.666, // ⅔
  '\u00BE': 0.75,  // ¾
  '\u215E': 0.875, // ⅞
};

// Conversion factors to metric (ml or grams)
// Note: For dry ingredients, cups to grams varies by ingredient
// We use ml for volume consistency, users can interpret based on density
const CONVERSIONS = {
  // Volume conversions (to ml)
  cup: { toMetric: 240, metricUnit: 'ml', type: 'volume' },
  cups: { toMetric: 240, metricUnit: 'ml', type: 'volume' },
  tablespoon: { toMetric: 15, metricUnit: 'ml', type: 'volume' },
  tablespoons: { toMetric: 15, metricUnit: 'ml', type: 'volume' },
  tbsp: { toMetric: 15, metricUnit: 'ml', type: 'volume' },
  teaspoon: { toMetric: 5, metricUnit: 'ml', type: 'volume' },
  teaspoons: { toMetric: 5, metricUnit: 'ml', type: 'volume' },
  tsp: { toMetric: 5, metricUnit: 'ml', type: 'volume' },
  'fluid ounce': { toMetric: 30, metricUnit: 'ml', type: 'volume' },
  'fluid ounces': { toMetric: 30, metricUnit: 'ml', type: 'volume' },
  'fl oz': { toMetric: 30, metricUnit: 'ml', type: 'volume' },
  'fl. oz': { toMetric: 30, metricUnit: 'ml', type: 'volume' },
  quart: { toMetric: 950, metricUnit: 'ml', type: 'volume' },
  quarts: { toMetric: 950, metricUnit: 'ml', type: 'volume' },
  qt: { toMetric: 950, metricUnit: 'ml', type: 'volume' },
  pint: { toMetric: 475, metricUnit: 'ml', type: 'volume' },
  pints: { toMetric: 475, metricUnit: 'ml', type: 'volume' },
  pt: { toMetric: 475, metricUnit: 'ml', type: 'volume' },
  gallon: { toMetric: 3785, metricUnit: 'ml', type: 'volume' },
  gallons: { toMetric: 3785, metricUnit: 'ml', type: 'volume' },

  // Weight conversions (to grams)
  ounce: { toMetric: 28, metricUnit: 'g', type: 'weight' },
  ounces: { toMetric: 28, metricUnit: 'g', type: 'weight' },
  oz: { toMetric: 28, metricUnit: 'g', type: 'weight' },
  pound: { toMetric: 454, metricUnit: 'g', type: 'weight' },
  pounds: { toMetric: 454, metricUnit: 'g', type: 'weight' },
  lb: { toMetric: 454, metricUnit: 'g', type: 'weight' },
  lbs: { toMetric: 454, metricUnit: 'g', type: 'weight' },
};

// Reverse mappings for metric to imperial
const METRIC_TO_IMPERIAL = {
  ml: [
    { imperialUnit: 'tsp', factor: 5, max: 15 },
    { imperialUnit: 'tbsp', factor: 15, max: 60 },
    { imperialUnit: 'cup', factor: 240, max: Infinity },
  ],
  g: [
    { imperialUnit: 'oz', factor: 28, max: 454 },
    { imperialUnit: 'lb', factor: 454, max: Infinity },
  ],
};

/**
 * Parse a fraction string to decimal
 * Handles: "1/2", "3/4", unicode fractions, and mixed numbers like "1 1/2"
 */
function parseFraction(str) {
  if (!str) return null;

  str = str.trim();
  let total = 0;

  // Check for unicode fraction
  for (const [symbol, decimal] of Object.entries(UNICODE_TO_DECIMAL)) {
    if (str.includes(symbol)) {
      const parts = str.split(symbol);
      const whole = parts[0].trim();
      total = whole ? parseFloat(whole) : 0;
      total += decimal;
      return total;
    }
  }

  // Check for slash fraction (e.g., "1/2" or "1 1/2")
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
  }

  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
  }

  // Try parsing as regular number
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Format a number to a sensible cooking measurement
 * Rounds to common cooking fractions when close
 */
function formatMeasurement(value, unit) {
  if (value === 0) return '0';

  // For metric, round to sensible values
  if (unit === 'ml') {
    // Round to nearest 5ml for values under 50, nearest 10 for larger
    if (value < 15) {
      return Math.round(value).toString();
    } else if (value < 50) {
      return (Math.round(value / 5) * 5).toString();
    } else if (value < 250) {
      return (Math.round(value / 10) * 10).toString();
    } else if (value < 1000) {
      return (Math.round(value / 25) * 25).toString();
    } else {
      // Convert to liters for large volumes
      const liters = value / 1000;
      if (liters === Math.floor(liters)) {
        return liters.toString();
      }
      return liters.toFixed(1).replace(/\.0$/, '');
    }
  }

  if (unit === 'g') {
    // Round to nearest 5g for small amounts, 10g for larger
    if (value < 50) {
      return (Math.round(value / 5) * 5).toString();
    } else if (value < 500) {
      return (Math.round(value / 10) * 10).toString();
    } else if (value < 1000) {
      return (Math.round(value / 25) * 25).toString();
    } else {
      // Convert to kg for large weights
      const kg = value / 1000;
      if (kg === Math.floor(kg)) {
        return kg.toString();
      }
      return kg.toFixed(1).replace(/\.0$/, '');
    }
  }

  // For imperial, try to use nice fractions
  const whole = Math.floor(value);
  const fractional = value - whole;

  // Common fractions used in cooking
  const fractions = [
    { decimal: 0.125, display: '\u215B' }, // ⅛
    { decimal: 0.25, display: '\u00BC' },  // ¼
    { decimal: 0.333, display: '\u2153' }, // ⅓
    { decimal: 0.375, display: '\u215C' }, // ⅜
    { decimal: 0.5, display: '\u00BD' },   // ½
    { decimal: 0.625, display: '\u215D' }, // ⅝
    { decimal: 0.666, display: '\u2154' }, // ⅔
    { decimal: 0.75, display: '\u00BE' },  // ¾
    { decimal: 0.875, display: '\u215E' }, // ⅞
  ];

  // Find closest fraction within tolerance
  for (const { decimal, display } of fractions) {
    if (Math.abs(fractional - decimal) < 0.05) {
      if (whole > 0) {
        return `${whole}${display}`;
      }
      return display;
    }
  }

  // No nice fraction, return decimal
  if (whole > 0 && fractional < 0.05) {
    return whole.toString();
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Get the proper unit name (singular/plural)
 */
function getUnitDisplay(unit, value) {
  // Metric units don't change
  if (unit === 'ml' || unit === 'g' || unit === 'L' || unit === 'kg') {
    return unit;
  }

  // Handle pluralization for imperial
  const singularForms = {
    cups: 'cup',
    tablespoons: 'tablespoon',
    teaspoons: 'teaspoon',
    ounces: 'ounce',
    pounds: 'pound',
    quarts: 'quart',
    pints: 'pint',
    gallons: 'gallon',
    'fluid ounces': 'fluid ounce',
  };

  const pluralForms = {
    cup: 'cups',
    tablespoon: 'tablespoons',
    teaspoon: 'teaspoons',
    ounce: 'ounces',
    pound: 'pounds',
    quart: 'quarts',
    pint: 'pints',
    gallon: 'gallons',
    'fluid ounce': 'fluid ounces',
    tbsp: 'tbsp',
    tsp: 'tsp',
    oz: 'oz',
    lb: 'lbs',
    qt: 'qt',
    pt: 'pt',
  };

  if (value === 1 || (value > 0 && value < 1)) {
    return singularForms[unit] || unit;
  }
  return pluralForms[unit] || unit;
}

/**
 * Convert a measurement value from one unit to another
 * @param {number} value - The numeric value
 * @param {string} fromUnit - The unit to convert from
 * @param {boolean} toMetric - True to convert to metric, false to imperial
 * @returns {{ value: number, unit: string } | null}
 */
export function convertMeasurement(value, fromUnit, toMetric) {
  const normalizedUnit = fromUnit.toLowerCase().trim();
  const conversion = CONVERSIONS[normalizedUnit];

  if (!conversion) {
    return null; // Unknown unit, can't convert
  }

  if (toMetric) {
    let metricValue = value * conversion.toMetric;
    let metricUnit = conversion.metricUnit;

    // Upgrade to larger units if sensible
    if (metricUnit === 'ml' && metricValue >= 1000) {
      metricValue = metricValue / 1000;
      metricUnit = 'L';
    } else if (metricUnit === 'g' && metricValue >= 1000) {
      metricValue = metricValue / 1000;
      metricUnit = 'kg';
    }

    return { value: metricValue, unit: metricUnit };
  } else {
    // Already imperial, return as-is
    return { value, unit: fromUnit };
  }
}

/**
 * Convert temperature
 * @param {number} temp - Temperature value
 * @param {boolean} toMetric - True to convert F to C
 * @returns {{ value: number, unit: string }}
 */
export function convertTemperature(temp, toMetric) {
  if (toMetric) {
    // F to C: (F - 32) * 5/9
    const celsius = Math.round((temp - 32) * 5 / 9);
    return { value: celsius, unit: 'C' };
  } else {
    // C to F: (C * 9/5) + 32
    const fahrenheit = Math.round((temp * 9 / 5) + 32);
    return { value: fahrenheit, unit: 'F' };
  }
}

/**
 * Parse and convert an ingredient line
 * @param {string} ingredientString - Full ingredient line (e.g., "1/2 cup butter, softened")
 * @param {boolean} toMetric - True to convert to metric
 * @returns {string} - Converted ingredient string
 */
export function convertIngredient(ingredientString, toMetric) {
  if (!ingredientString || typeof ingredientString !== 'string') {
    return ingredientString;
  }

  // If converting to imperial and it's already imperial (no conversion needed)
  // We need to detect if the string contains metric units first
  const hasMetricUnit = /\b(\d+\.?\d*)\s*(ml|mL|g|kg|L|liters?|grams?|kilograms?|milliliters?)\b/i.test(ingredientString);

  if (!toMetric && !hasMetricUnit) {
    return ingredientString; // Already imperial
  }

  if (toMetric && hasMetricUnit) {
    return ingredientString; // Already metric
  }

  // Build regex to match quantity + unit patterns
  // Matches: "1/2 cup", "1 1/2 cups", "2 tablespoons", "½ tsp", "1½ cups"
  const unitNames = Object.keys(CONVERSIONS).join('|');

  // Pattern for numbers including fractions
  const numberPattern = '(?:\\d+\\s+)?(?:\\d+\\/\\d+|[\\u00BC\\u00BD\\u00BE\\u2153\\u2154\\u215B\\u215C\\u215D\\u215E]|\\d+[\\u00BC\\u00BD\\u00BE\\u2153\\u2154\\u215B\\u215C\\u215D\\u215E]?|\\d+\\.\\d+|\\d+)';

  const regex = new RegExp(`(${numberPattern})\\s*(${unitNames})\\b`, 'gi');

  return ingredientString.replace(regex, (match, quantity, unit) => {
    const value = parseFraction(quantity);
    if (value === null) {
      return match; // Couldn't parse, return original
    }

    const converted = convertMeasurement(value, unit, toMetric);
    if (!converted) {
      return match; // Unknown unit, return original
    }

    const formattedValue = formatMeasurement(converted.value, converted.unit);
    const displayUnit = getUnitDisplay(converted.unit, converted.value);

    return `${formattedValue} ${displayUnit}`;
  });
}

/**
 * Convert all ingredients in an array
 * @param {string[]} ingredients - Array of ingredient strings
 * @param {boolean} toMetric - True to convert to metric
 * @returns {string[]} - Converted ingredient strings
 */
export function convertIngredients(ingredients, toMetric) {
  if (!Array.isArray(ingredients)) {
    return ingredients;
  }
  return ingredients.map(ing => convertIngredient(ing, toMetric));
}

/**
 * Check if a string contains a temperature and convert it
 * @param {string} text - Text that may contain temperature
 * @param {boolean} toMetric - True to convert F to C
 * @returns {string} - Text with converted temperature
 */
export function convertTemperatureInText(text, toMetric) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Match patterns like "350°F", "350 degrees F", "350F"
  const fahrenheitPattern = /(\d+)\s*(?:°|degrees?\s*)?\s*F(?:ahrenheit)?/gi;
  const celsiusPattern = /(\d+)\s*(?:°|degrees?\s*)?\s*C(?:elsius)?/gi;

  if (toMetric) {
    return text.replace(fahrenheitPattern, (match, temp) => {
      const converted = convertTemperature(parseInt(temp), true);
      return `${converted.value}\u00B0${converted.unit}`;
    });
  } else {
    return text.replace(celsiusPattern, (match, temp) => {
      const converted = convertTemperature(parseInt(temp), false);
      return `${converted.value}\u00B0${converted.unit}`;
    });
  }
}

export default {
  convertMeasurement,
  convertTemperature,
  convertIngredient,
  convertIngredients,
  convertTemperatureInText,
};
