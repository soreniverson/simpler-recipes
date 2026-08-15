/**
 * YouTube helpers for the extraction route.
 *
 * Recipe parsing lives in src/lib/recipe/* (tested); the AI fallbacks in src/lib/recipe/ai.ts.
 * This file only keeps the YouTube-specific pieces: video-id detection, description parsing,
 * the Data API lookup, and the transcript scrape.
 */
import { safeFetch } from '../lib/safeFetch';
import { decodeEntities } from '../lib/recipe/normalize';

/** @deprecated — use `Recipe` from src/lib/recipe/types. Kept as an alias for old imports. */
export type { Recipe as ExtractedRecipe } from '../lib/recipe/types';

export interface DescriptionParseResult {
  ingredients: string[];
  instructions: string[];
  recipeLink: string | null;
}

// ============ YOUTUBE HELPERS ============

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

export function getYouTubeVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return getYouTubeVideoId(url) !== null;
}

// ============ YOUTUBE DESCRIPTION PARSING ============

export function findRecipeLink(description: string): string | null {
  const recipeLinePattern = /(?:full\s+)?recipe\s*(?:here)?[:.\s]+\s*(https?:\/\/[^\s]+)/i;
  const match = description.match(recipeLinePattern);
  if (match) return match[1];

  const lines = description.split('\n');
  for (const line of lines) {
    const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      const url = urlMatch[1];
      if (
        !url.includes('youtube.com') &&
        !url.includes('youtu.be') &&
        !url.includes('instagram.com') &&
        !url.includes('twitter.com') &&
        !url.includes('facebook.com') &&
        !url.includes('tiktok.com') &&
        !url.includes('shop-links.co') &&
        !url.includes('amzn.') &&
        !url.includes('amazon.com') &&
        !url.includes('reddit.com') &&
        (url.includes('/recipe') || url.includes('/post/') || url.includes('weissman'))
      ) {
        return url;
      }
    }
  }
  return null;
}

export function parseRecipeFromDescription(description: string): DescriptionParseResult {
  const lines = description.split('\n').map((l) => l.trim()).filter(Boolean);
  const ingredients: string[] = [];
  const instructions: string[] = [];
  let section: 'none' | 'ingredients' | 'instructions' = 'none';

  const ingredientHeaders = /^(ingredients|what you.?ll need|you.?ll need|shopping list|groceries|for the)/i;
  const instructionHeaders = /^(instructions|directions|method|steps|how to make|preparation|procedure)/i;
  const endSectionHeaders = /^(notes|tips|nutrition|equipment|tools|music|follow me|subscribe|links|credits|sources|recipe:|#|\u{1F44D})/iu;

  for (const line of lines) {
    if (ingredientHeaders.test(line)) {
      section = 'ingredients';
      continue;
    }
    if (instructionHeaders.test(line)) {
      section = 'instructions';
      continue;
    }
    if (endSectionHeaders.test(line)) {
      section = 'none';
      continue;
    }
    if (line.startsWith('http') || line.startsWith('www.')) continue;
    if (/^#\w/.test(line)) continue;
    if (line.length < 3) continue;

    if (section === 'ingredients') {
      const cleaned = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (cleaned.length > 2 && !cleaned.includes('amazon') && !cleaned.includes('amzn')) {
        ingredients.push(cleaned);
      }
    } else if (section === 'instructions') {
      const cleaned = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (cleaned.length > 5) instructions.push(cleaned);
    }
  }

  const recipeLink = ingredients.length === 0 ? findRecipeLink(description) : null;
  return { ingredients, instructions, recipeLink };
}

// ============ YOUTUBE TRANSCRIPT ============

export async function fetchYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    const page = await safeFetch(`https://www.youtube.com/watch?v=${videoId}`, { maxBytes: 4 * 1024 * 1024 });
    const timedTextMatch = page.body.match(/"baseUrl":\s*"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/);
    if (!timedTextMatch) return null;
    const timedTextUrl = timedTextMatch[1].replace(/\\u0026/g, '&');
    const transcript = await safeFetch(timedTextUrl);
    const texts: string[] = [];
    for (const match of transcript.body.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) {
      const text = decodeEntities(match[1]).trim();
      if (text) texts.push(text);
    }
    return texts.join(' ');
  } catch {
    return null;
  }
}

// ============ YOUTUBE DATA API ============

export async function fetchYouTubeVideoInfo(
  videoId: string,
  apiKey: string
): Promise<{ title: string; description: string; thumbnail: string | null } | null> {
  if (!apiKey) return null;
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}&part=snippet`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.items?.length) return null;
    const video = data.items[0].snippet;
    return {
      title: video.title || 'Untitled Recipe',
      description: video.description || '',
      thumbnail: video.thumbnails?.maxres?.url || video.thumbnails?.high?.url || video.thumbnails?.medium?.url || null,
    };
  } catch {
    return null;
  }
}
