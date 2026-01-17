import { readFileSync } from 'fs'
import { join } from 'path'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { slug } = req.query

  try {
    const dataPath = join(process.cwd(), 'recipe-data', `${slug}.json`)
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    return res.status(200).json(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Collection not found' })
    }
    console.error('Error loading collection:', error)
    return res.status(500).json({ error: 'Failed to load collection' })
  }
}
