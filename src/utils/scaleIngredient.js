/**
 * Parses and scales ingredient quantities.
 *
 * Handles formats like:
 *   "4 cups water"
 *   "0.5 cup milk"
 *   "1/2 cup milk"
 *   "2½ cups sugar"
 *   "1 (8 ounce) can tomatoes"
 */

// Unicode fractions to decimal
const UNICODE_TO_DECIMAL = {
  '⅛': 0.125,
  '¼': 0.25,
  '⅓': 0.333,
  '⅜': 0.375,
  '½': 0.5,
  '⅝': 0.625,
  '⅔': 0.666,
  '¾': 0.75,
  '⅞': 0.875,
}

// Decimal to unicode fraction (for nice output)
const DECIMAL_TO_UNICODE = {
  0.125: '⅛',
  0.25: '¼',
  0.333: '⅓',
  0.375: '⅜',
  0.5: '½',
  0.625: '⅝',
  0.666: '⅔',
  0.75: '¾',
  0.875: '⅞',
}

const TOLERANCE = 0.02

/**
 * Convert a number to a nice display string with fractions
 */
function formatQuantity(num) {
  if (num === 0) return '0'

  const whole = Math.floor(num)
  const fractional = num - whole

  // Check if fractional part matches a known fraction
  for (const [decimal, symbol] of Object.entries(DECIMAL_TO_UNICODE)) {
    if (Math.abs(fractional - parseFloat(decimal)) < TOLERANCE) {
      if (whole > 0) {
        return `${whole}${symbol}`
      }
      return symbol
    }
  }

  // No nice fraction, return decimal rounded appropriately
  if (fractional === 0) {
    return whole.toString()
  }

  // Round to reasonable precision
  const rounded = Math.round(num * 100) / 100
  // Remove trailing zeros
  return rounded.toString().replace(/\.?0+$/, '')
}

/**
 * Parse the quantity from the start of an ingredient string
 * Returns { quantity: number | null, rest: string }
 */
function parseIngredient(text) {
  if (!text || typeof text !== 'string') {
    return { quantity: null, rest: text }
  }

  let str = text.trim()
  let quantity = 0
  let matched = false

  // Pattern 1: Leading decimal like "0.5" or "2.5"
  const decimalMatch = str.match(/^(\d+\.?\d*)\s*/)
  if (decimalMatch) {
    quantity = parseFloat(decimalMatch[1])
    str = str.slice(decimalMatch[0].length)
    matched = true

    // Check for unicode fraction immediately after (like "2½")
    for (const [symbol, decimal] of Object.entries(UNICODE_TO_DECIMAL)) {
      if (str.startsWith(symbol)) {
        quantity += decimal
        str = str.slice(1).trimStart()
        break
      }
    }
  }

  // Pattern 2: Leading unicode fraction like "½"
  if (!matched) {
    for (const [symbol, decimal] of Object.entries(UNICODE_TO_DECIMAL)) {
      if (str.startsWith(symbol)) {
        quantity = decimal
        str = str.slice(1).trimStart()
        matched = true
        break
      }
    }
  }

  // Pattern 3: Slash fraction like "1/2" (only if no decimal matched yet)
  if (!matched) {
    const fractionMatch = str.match(/^(\d+)\/(\d+)\s*/)
    if (fractionMatch) {
      quantity = parseInt(fractionMatch[1]) / parseInt(fractionMatch[2])
      str = str.slice(fractionMatch[0].length)
      matched = true
    }
  }

  // Pattern 4: Mixed number like "1 1/2" (whole number followed by fraction)
  if (matched && quantity >= 1) {
    const mixedMatch = str.match(/^(\d+)\/(\d+)\s*/)
    if (mixedMatch) {
      quantity += parseInt(mixedMatch[1]) / parseInt(mixedMatch[2])
      str = str.slice(mixedMatch[0].length)
    }
  }

  if (!matched || quantity === 0) {
    return { quantity: null, rest: text }
  }

  return { quantity, rest: str }
}

/**
 * Scale an ingredient string by a multiplier
 * @param {string} ingredient - The ingredient string
 * @param {number} multiplier - Scale factor (e.g., 2 to double)
 * @returns {string} - Scaled ingredient string
 */
export function scaleIngredient(ingredient, multiplier) {
  if (multiplier === 1) return ingredient

  const { quantity, rest } = parseIngredient(ingredient)

  if (quantity === null) {
    return ingredient // Can't scale, return as-is
  }

  const scaled = quantity * multiplier
  const formatted = formatQuantity(scaled)

  return `${formatted} ${rest}`
}

/**
 * Scale all ingredients in an array
 * @param {string[]} ingredients - Array of ingredient strings
 * @param {number} originalServings - Original serving count
 * @param {number} newServings - Desired serving count
 * @returns {string[]} - Scaled ingredient strings
 */
export function scaleIngredients(ingredients, originalServings, newServings) {
  const multiplier = newServings / originalServings
  return ingredients.map(ing => scaleIngredient(ing, multiplier))
}

/**
 * Parse servings string to number
 * Handles "6", "6 servings", "serves 6", etc.
 */
export function parseServings(servingsStr) {
  if (!servingsStr) return null
  if (typeof servingsStr === 'number') return servingsStr

  const match = servingsStr.match(/\d+/)
  return match ? parseInt(match[0]) : null
}

export default scaleIngredient
