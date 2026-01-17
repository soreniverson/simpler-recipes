/**
 * Share link retrieval API endpoint
 * Fetches stored recipe data by ID
 */

// Note: In serverless, each function instance has its own memory
// This import won't share state with share.js in production
// For production, use Vercel KV or another persistent store
import { storage } from '../share.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'ID is required' })
  }

  const data = storage.get(id)

  if (!data) {
    return res.status(404).json({
      error: 'Recipe not found. The link may have expired or is invalid.',
    })
  }

  // Check if expired
  if (data.expiresAt < Date.now()) {
    storage.delete(id)
    return res.status(404).json({
      error: 'This shared recipe has expired.',
    })
  }

  return res.status(200).json({
    recipe: data.recipe,
    sourceUrl: data.sourceUrl,
  })
}
