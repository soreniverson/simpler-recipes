/**
 * Converts decimal fractions in a string to human-readable unicode fractions.
 *
 * Examples:
 *   "0.5 cup milk" → "½ cup milk"
 *   "0.33333334326744 cup flour" → "⅓ cup flour"
 *   "2.5 cups sugar" → "2½ cups sugar"
 */

const FRACTION_MAP = {
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

// Tolerance for matching fractions (handles floating point imprecision)
const TOLERANCE = 0.02

function findFraction(decimal) {
  // Normalize to 0-1 range
  const fractionalPart = decimal % 1

  for (const [key, symbol] of Object.entries(FRACTION_MAP)) {
    if (Math.abs(fractionalPart - parseFloat(key)) < TOLERANCE) {
      return { symbol, wholePart: Math.floor(decimal) }
    }
  }

  return null
}

export function formatFraction(text) {
  if (!text || typeof text !== 'string') return text

  // Match decimal numbers (including those with many decimal places)
  return text.replace(/(\d+)?\.(\d+)/g, (match, whole, decimal) => {
    const fullNumber = parseFloat(match)
    const result = findFraction(fullNumber)

    if (result) {
      const { symbol, wholePart } = result
      if (wholePart > 0) {
        return `${wholePart}${symbol}`
      }
      return symbol
    }

    // No matching fraction found - return cleaned up decimal
    // Round to 2 decimal places for cleaner display
    const rounded = Math.round(fullNumber * 100) / 100
    return rounded.toString()
  })
}

export default formatFraction
