import { readFileSync } from 'fs'
import { join } from 'path'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const dataPath = join(process.cwd(), 'recipe-data', 'all-recipes.json')
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

    // Return just collections metadata (not full recipes) for the index
    const response = {
      metadata: data.metadata,
      collections: data.collections.map(c => ({
        slug: c.slug,
        name: c.name,
        description: c.description,
        recipeCount: c.recipeCount,
        recipes: c.recipes.slice(0, 5) // Preview of first 5 recipe slugs
      }))
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    return res.status(200).json(response)
  } catch (error) {
    console.error('Error loading recipes:', error)
    return res.status(500).json({ error: 'Failed to load recipes' })
  }
}
