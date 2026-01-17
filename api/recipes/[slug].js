import { readFileSync } from 'fs'
import { join } from 'path'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { slug } = req.query

  try {
    const dataPath = join(process.cwd(), 'recipe-data', 'all-recipes.json')
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

    const recipe = data.recipes.find(r => r.slug === slug)

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' })
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    return res.status(200).json(recipe)
  } catch (error) {
    console.error('Error loading recipe:', error)
    return res.status(500).json({ error: 'Failed to load recipe' })
  }
}
