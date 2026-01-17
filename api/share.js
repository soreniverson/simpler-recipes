/**
 * Share link creation API endpoint
 * Creates a unique ID and stores the recipe data
 */

import { nanoid } from 'nanoid'

// In-memory storage for MVP
// Note: This resets on each deployment/cold start
// For production, use Vercel KV or another persistent store
const storage = new Map()

// TTL for shared recipes: 7 days
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { recipe, sourceUrl } = req.body

  if (!recipe) {
    return res.status(400).json({ error: 'Recipe data is required' })
  }

  // Validate recipe has minimum required fields
  if (!recipe.title || (!recipe.ingredients?.length && !recipe.instructions?.length)) {
    return res.status(400).json({ error: 'Invalid recipe data' })
  }

  // Generate unique ID
  const id = nanoid(10)

  // Store with expiration timestamp
  storage.set(id, {
    recipe,
    sourceUrl,
    expiresAt: Date.now() + TTL_MS,
  })

  // Clean up expired entries occasionally (simple garbage collection)
  if (Math.random() < 0.1) {
    const now = Date.now()
    for (const [key, value] of storage.entries()) {
      if (value.expiresAt < now) {
        storage.delete(key)
      }
    }
  }

  return res.status(200).json({ id })
}

// Export storage for the retrieval endpoint
export { storage }
