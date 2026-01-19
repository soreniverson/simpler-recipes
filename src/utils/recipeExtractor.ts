import Anthropic from '@anthropic-ai/sdk';

// ============ TYPES ============

export interface ExtractedRecipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  prepTime: string | null;
  cookTime: string | null;
  servings: string | null;
  image: string | null;
  source?: string;
}

export interface DescriptionParseResult {
  ingredients: string[];
  instructions: string[];
  recipeLink: string | null;
}

// ============ YOUTUBE HELPERS ============

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
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

// ============ HTML/TEXT PARSING HELPERS ============

export function decodeHtmlEntities(str: string | null | undefined): string {
  if (!str || typeof str !== 'string') return str || '';
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&#x27;': "'", '&apos;': "'", '&#x2F;': '/',
    '&#47;': '/', '&nbsp;': ' ',
  };
  return str
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x27|#x2F|#47);/gi, (match) => entities[match] || match)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function parseDuration(duration: string | null | undefined): string | null {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  if (minutes) parts.push(`${minutes} min`);
  return parts.join(' ') || null;
}

export function parseInstructions(instructions: any): string[] {
  if (!instructions) return [];
  if (typeof instructions === 'string') {
    return instructions.split(/\n|(?=\d+\.\s)/).map((s) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
  }
  if (Array.isArray(instructions)) {
    return instructions.flatMap((item) => {
      if (typeof item === 'object' && item !== null) {
        if (item['@type'] === 'HowToStep') return item.text || item.name || '';
        if (item['@type'] === 'HowToSection') return parseInstructions(item.itemListElement);
        if (item.text) return item.text;
        if (item.name) return item.name;
      }
      if (typeof item === 'string') return item.replace(/^\d+\.\s*/, '').trim();
      return '';
    }).filter(Boolean);
  }
  return [];
}

export function parseImage(image: any): string | null {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return parseImage(image[0]);
  if (typeof image === 'object') return image.url || image.contentUrl || null;
  return null;
}

export function parseYield(recipeYield: any): string | null {
  if (!recipeYield) return null;
  if (typeof recipeYield === 'number') return String(recipeYield);
  if (typeof recipeYield === 'string') return recipeYield;
  if (Array.isArray(recipeYield)) return recipeYield[0]?.toString() || null;
  return null;
}

// ============ JSON-LD EXTRACTION ============

export function findRecipeInJsonLd(jsonLd: any): any {
  if (!jsonLd) return null;
  if (jsonLd['@type'] === 'Recipe') return jsonLd;
  if (Array.isArray(jsonLd['@type']) && jsonLd['@type'].includes('Recipe')) return jsonLd;
  if (Array.isArray(jsonLd)) {
    for (const item of jsonLd) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }
  if (jsonLd['@graph'] && Array.isArray(jsonLd['@graph'])) {
    for (const item of jsonLd['@graph']) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }
  return null;
}

export function extractJsonLdScripts(html: string): any[] {
  const scripts: any[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      scripts.push(JSON.parse(match[1]));
    } catch {}
  }
  return scripts;
}

export function parseRecipeFromJsonLd(recipeSchema: any): ExtractedRecipe | null {
  if (!recipeSchema) return null;

  const ingredients = Array.isArray(recipeSchema.recipeIngredient)
    ? recipeSchema.recipeIngredient.map(decodeHtmlEntities)
    : [];
  const instructions = parseInstructions(recipeSchema.recipeInstructions).map(decodeHtmlEntities);

  if (ingredients.length === 0 && instructions.length === 0) return null;

  return {
    title: decodeHtmlEntities(recipeSchema.name) || 'Untitled Recipe',
    ingredients,
    instructions,
    prepTime: parseDuration(recipeSchema.prepTime),
    cookTime: parseDuration(recipeSchema.cookTime),
    servings: parseYield(recipeSchema.recipeYield),
    image: parseImage(recipeSchema.image),
  };
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
  const lines = description.split('\n').map(l => l.trim()).filter(Boolean);
  const ingredients: string[] = [];
  const instructions: string[] = [];
  let section: 'none' | 'ingredients' | 'instructions' = 'none';

  const ingredientHeaders = /^(ingredients|what you.?ll need|you.?ll need|shopping list|groceries|for the)/i;
  const instructionHeaders = /^(instructions|directions|method|steps|how to make|preparation|procedure)/i;
  const endSectionHeaders = /^(notes|tips|nutrition|equipment|tools|music|follow me|subscribe|links|credits|sources|recipe:|#|\u{1F44D})/iu;

  for (const line of lines) {
    if (ingredientHeaders.test(line)) { section = 'ingredients'; continue; }
    if (instructionHeaders.test(line)) { section = 'instructions'; continue; }
    if (endSectionHeaders.test(line)) { section = 'none'; continue; }
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
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const timedTextMatch = html.match(/"baseUrl":\s*"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/);
    if (!timedTextMatch) return null;

    const timedTextUrl = timedTextMatch[1].replace(/\\u0026/g, '&');
    const transcriptResponse = await fetch(timedTextUrl);
    if (!transcriptResponse.ok) return null;

    const transcriptXml = await transcriptResponse.text();
    const textMatches = transcriptXml.matchAll(/<text[^>]*>([^<]*)<\/text>/g);
    const texts: string[] = [];
    for (const match of textMatches) {
      const text = match[1]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
      if (text) texts.push(text);
    }
    return texts.join(' ');
  } catch {
    return null;
  }
}

// ============ CLAUDE AI EXTRACTION ============

export async function extractWithClaude(html: string, apiKey: string): Promise<Partial<ExtractedRecipe> | null> {
  if (!apiKey) return null;
  try {
    const client = new Anthropic({ apiKey });
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\s+/g, ' ')
      .substring(0, 15000);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract the recipe from this webpage content. Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{"title": "Recipe Title", "ingredients": ["ingredient 1", "ingredient 2"], "instructions": ["step 1", "step 2"], "prepTime": "10 mins" or null, "cookTime": "20 mins" or null, "servings": "4" or null}
If no recipe is found, return: {"error": "No recipe found"}

Webpage content:
${cleanedHtml}`
      }]
    });

    const content = message.content[0];
    if (content.type === 'text') {
      const parsed = JSON.parse(content.text);
      if (parsed.error) return null;
      return parsed;
    }
  } catch (err) {
    console.error('Claude extraction error:', err);
  }
  return null;
}

export async function extractInstructionsFromTranscript(
  transcript: string,
  title: string,
  ingredients: string[],
  apiKey: string
): Promise<string[]> {
  if (!apiKey || !transcript) return [];
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract cooking instructions from this video transcript. The recipe is "${title}" with these ingredients: ${ingredients.slice(0, 10).join(', ')}.

Return ONLY a JSON array of step-by-step instructions (no markdown, no explanation). Each step should be a clear, concise cooking instruction. Ignore any non-cooking content.

Example format: ["Season the chicken with salt and pepper", "Heat oil in a pan over medium-high heat"]

If no clear cooking instructions can be extracted, return: []

Transcript:
${transcript.substring(0, 12000)}`
      }]
    });

    const content = message.content[0];
    if (content.type === 'text') {
      const parsed = JSON.parse(content.text);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

// ============ PAGE FETCHING ============

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SimplerRecipes/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function fetchYouTubeVideoInfo(videoId: string, apiKey: string): Promise<{
  title: string;
  description: string;
  thumbnail: string | null;
} | null> {
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet`
    );
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
