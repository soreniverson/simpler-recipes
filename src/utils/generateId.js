import { nanoid } from 'nanoid'

/**
 * Generate a unique ID for share links
 * Uses nanoid with a shorter length for cleaner URLs
 * @returns {string} A unique ID
 */
export function generateId() {
  return nanoid(10)
}
