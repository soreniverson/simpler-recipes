/**
 * Parse ISO 8601 duration to human-readable format
 * @param {string} duration - ISO 8601 duration (e.g., "PT30M", "PT1H30M")
 * @returns {string} Human-readable duration (e.g., "30 min", "1 hr 30 min")
 */
export function parseDuration(duration) {
  if (!duration) return null

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return duration

  const hours = parseInt(match[1]) || 0
  const minutes = parseInt(match[2]) || 0

  const parts = []
  if (hours) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`)
  if (minutes) parts.push(`${minutes} min`)

  return parts.join(' ') || null
}

/**
 * Extract instructions from various formats
 * @param {string|Array} instructions - Recipe instructions in various formats
 * @returns {string[]} Array of instruction strings
 */
export function parseInstructions(instructions) {
  if (!instructions) return []

  // If it's a string, split by newlines or numbered steps
  if (typeof instructions === 'string') {
    return instructions
      .split(/\n|(?=\d+\.\s)/)
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)
  }

  // If it's an array
  if (Array.isArray(instructions)) {
    return instructions.flatMap((item) => {
      // Handle HowToStep objects
      if (typeof item === 'object' && item !== null) {
        if (item['@type'] === 'HowToStep') {
          return item.text || item.name || ''
        }
        if (item['@type'] === 'HowToSection') {
          // Handle sections with nested steps
          return parseInstructions(item.itemListElement)
        }
        // Generic object with text
        if (item.text) return item.text
        if (item.name) return item.name
      }
      // Plain string
      if (typeof item === 'string') {
        return item.replace(/^\d+\.\s*/, '').trim()
      }
      return ''
    }).filter(Boolean)
  }

  return []
}

/**
 * Extract image URL from various formats
 * @param {string|Array|Object} image - Image in various formats
 * @returns {string|null} Image URL or null
 */
export function parseImage(image) {
  if (!image) return null

  if (typeof image === 'string') {
    return image
  }

  if (Array.isArray(image)) {
    return parseImage(image[0])
  }

  if (typeof image === 'object') {
    return image.url || image.contentUrl || null
  }

  return null
}

/**
 * Extract recipe yield/servings from various formats
 * @param {string|number|Array} recipeYield - Yield in various formats
 * @returns {string|null} Servings string or null
 */
export function parseYield(recipeYield) {
  if (!recipeYield) return null

  if (typeof recipeYield === 'number') {
    return String(recipeYield)
  }

  if (typeof recipeYield === 'string') {
    return recipeYield
  }

  if (Array.isArray(recipeYield)) {
    return recipeYield[0]?.toString() || null
  }

  return null
}

/**
 * Parse recipe data from Schema.org JSON-LD
 * @param {Object} schema - Schema.org Recipe object
 * @returns {Object} Normalized recipe object
 */
export function parseRecipeSchema(schema) {
  return {
    title: schema.name || 'Untitled Recipe',
    ingredients: Array.isArray(schema.recipeIngredient)
      ? schema.recipeIngredient
      : [],
    instructions: parseInstructions(schema.recipeInstructions),
    prepTime: parseDuration(schema.prepTime),
    cookTime: parseDuration(schema.cookTime),
    servings: parseYield(schema.recipeYield),
    image: parseImage(schema.image),
  }
}

/**
 * Find Recipe schema from JSON-LD data
 * @param {Object|Array} jsonLd - Parsed JSON-LD data
 * @returns {Object|null} Recipe schema object or null
 */
export function findRecipeInJsonLd(jsonLd) {
  if (!jsonLd) return null

  // Direct Recipe type
  if (jsonLd['@type'] === 'Recipe') {
    return jsonLd
  }

  // Array of types (e.g., ["Recipe", "WebPage"])
  if (Array.isArray(jsonLd['@type']) && jsonLd['@type'].includes('Recipe')) {
    return jsonLd
  }

  // Array of schemas
  if (Array.isArray(jsonLd)) {
    for (const item of jsonLd) {
      const recipe = findRecipeInJsonLd(item)
      if (recipe) return recipe
    }
  }

  // @graph array (common in Yoast SEO)
  if (jsonLd['@graph'] && Array.isArray(jsonLd['@graph'])) {
    for (const item of jsonLd['@graph']) {
      const recipe = findRecipeInJsonLd(item)
      if (recipe) return recipe
    }
  }

  return null
}
