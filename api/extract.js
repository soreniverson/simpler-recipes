/**
 * Recipe extraction API endpoint
 * Fetches a URL server-side and extracts recipe data from Schema.org JSON-LD
 */

/**
 * Decode HTML entities in a string
 */
function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str

  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&apos;': "'",
    '&#x2F;': '/',
    '&#47;': '/',
    '&nbsp;': ' ',
  }

  return str
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x27|#x2F|#47);/gi, (match) => entities[match] || match)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Parse ISO 8601 duration to human-readable format
 */
function parseDuration(duration) {
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
 */
function parseInstructions(instructions) {
  if (!instructions) return []

  if (typeof instructions === 'string') {
    return instructions
      .split(/\n|(?=\d+\.\s)/)
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)
  }

  if (Array.isArray(instructions)) {
    return instructions.flatMap((item) => {
      if (typeof item === 'object' && item !== null) {
        if (item['@type'] === 'HowToStep') {
          return item.text || item.name || ''
        }
        if (item['@type'] === 'HowToSection') {
          return parseInstructions(item.itemListElement)
        }
        if (item.text) return item.text
        if (item.name) return item.name
      }
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
 */
function parseImage(image) {
  if (!image) return null

  if (typeof image === 'string') return image
  if (Array.isArray(image)) return parseImage(image[0])
  if (typeof image === 'object') return image.url || image.contentUrl || null

  return null
}

/**
 * Extract recipe yield/servings
 */
function parseYield(recipeYield) {
  if (!recipeYield) return null
  if (typeof recipeYield === 'number') return String(recipeYield)
  if (typeof recipeYield === 'string') return recipeYield
  if (Array.isArray(recipeYield)) return recipeYield[0]?.toString() || null
  return null
}

/**
 * Find Recipe schema from JSON-LD data
 */
function findRecipeInJsonLd(jsonLd) {
  if (!jsonLd) return null

  if (jsonLd['@type'] === 'Recipe') return jsonLd
  if (Array.isArray(jsonLd['@type']) && jsonLd['@type'].includes('Recipe')) return jsonLd

  if (Array.isArray(jsonLd)) {
    for (const item of jsonLd) {
      const recipe = findRecipeInJsonLd(item)
      if (recipe) return recipe
    }
  }

  if (jsonLd['@graph'] && Array.isArray(jsonLd['@graph'])) {
    for (const item of jsonLd['@graph']) {
      const recipe = findRecipeInJsonLd(item)
      if (recipe) return recipe
    }
  }

  return null
}

/**
 * Extract JSON-LD scripts from HTML
 */
function extractJsonLdScripts(html) {
  const scripts = []
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match

  while ((match = regex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1])
      scripts.push(json)
    } catch {
      // Invalid JSON, skip
    }
  }

  return scripts
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body

  if (!url) {
    return res.status(400).json({ error: 'URL is required' })
  }

  // Validate URL
  let parsedUrl
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  try {
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SimplerRecipes/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return res.status(400).json({
        error: `Failed to fetch recipe: ${response.status} ${response.statusText}`,
      })
    }

    const html = await response.text()

    // Extract JSON-LD scripts
    const jsonLdScripts = extractJsonLdScripts(html)

    // Find recipe schema
    let recipeSchema = null
    for (const script of jsonLdScripts) {
      recipeSchema = findRecipeInJsonLd(script)
      if (recipeSchema) break
    }

    if (!recipeSchema) {
      return res.status(400).json({
        error: 'No recipe found on this page. The site may not use Schema.org markup.',
      })
    }

    // Parse the recipe
    const recipe = {
      title: decodeHtmlEntities(recipeSchema.name) || 'Untitled Recipe',
      ingredients: Array.isArray(recipeSchema.recipeIngredient)
        ? recipeSchema.recipeIngredient.map(decodeHtmlEntities)
        : [],
      instructions: parseInstructions(recipeSchema.recipeInstructions).map(decodeHtmlEntities),
      prepTime: parseDuration(recipeSchema.prepTime),
      cookTime: parseDuration(recipeSchema.cookTime),
      servings: parseYield(recipeSchema.recipeYield),
      image: parseImage(recipeSchema.image),
    }

    // Validate we have at least ingredients or instructions
    if (recipe.ingredients.length === 0 && recipe.instructions.length === 0) {
      return res.status(400).json({
        error: 'Recipe data was found but appears to be incomplete.',
      })
    }

    return res.status(200).json(recipe)
  } catch (err) {
    console.error('Extract error:', err)
    return res.status(500).json({
      error: 'Failed to extract recipe. Please try another URL.',
    })
  }
}
