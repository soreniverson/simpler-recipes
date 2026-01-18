import type { APIRoute } from 'astro';

export const prerender = false;

function decodeHtmlEntities(str: string | null | undefined): string {
  if (!str || typeof str !== 'string') return str || '';

  const entities: Record<string, string> = {
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
  };

  return str
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x27|#x2F|#47);/gi, (match) => entities[match] || match)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseDuration(duration: string | null | undefined): string | null {
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

function parseInstructions(instructions: any): string[] {
  if (!instructions) return [];

  if (typeof instructions === 'string') {
    return instructions
      .split(/\n|(?=\d+\.\s)/)
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }

  if (Array.isArray(instructions)) {
    return instructions.flatMap((item) => {
      if (typeof item === 'object' && item !== null) {
        if (item['@type'] === 'HowToStep') {
          return item.text || item.name || '';
        }
        if (item['@type'] === 'HowToSection') {
          return parseInstructions(item.itemListElement);
        }
        if (item.text) return item.text;
        if (item.name) return item.name;
      }
      if (typeof item === 'string') {
        return item.replace(/^\d+\.\s*/, '').trim();
      }
      return '';
    }).filter(Boolean);
  }

  return [];
}

function parseImage(image: any): string | null {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return parseImage(image[0]);
  if (typeof image === 'object') return image.url || image.contentUrl || null;
  return null;
}

function parseYield(recipeYield: any): string | null {
  if (!recipeYield) return null;
  if (typeof recipeYield === 'number') return String(recipeYield);
  if (typeof recipeYield === 'string') return recipeYield;
  if (Array.isArray(recipeYield)) return recipeYield[0]?.toString() || null;
  return null;
}

function findRecipeInJsonLd(jsonLd: any): any {
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

function extractJsonLdScripts(html: string): any[] {
  const scripts: any[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      scripts.push(json);
    } catch {
      // Invalid JSON, skip
    }
  }

  return scripts;
}

export const POST: APIRoute = async ({ request }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { url } = body;

  if (!url) {
    return new Response(JSON.stringify({ error: 'URL is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SimplerRecipes/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch recipe: ${response.status} ${response.statusText}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Extract JSON-LD scripts
    const jsonLdScripts = extractJsonLdScripts(html);

    // Find recipe schema
    let recipeSchema = null;
    for (const script of jsonLdScripts) {
      recipeSchema = findRecipeInJsonLd(script);
      if (recipeSchema) break;
    }

    if (!recipeSchema) {
      return new Response(
        JSON.stringify({ error: 'No recipe found on this page. The site may not use Schema.org markup.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
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
    };

    // Validate we have at least ingredients or instructions
    if (recipe.ingredients.length === 0 && recipe.instructions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Recipe data was found but appears to be incomplete.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(recipe), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Extract error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to extract recipe. Please try another URL.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
