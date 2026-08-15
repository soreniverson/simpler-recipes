/**
 * Claude-powered fallbacks. Used only when structured data (JSON-LD / microdata / DOM
 * heuristics) yields nothing — the expensive last resort.
 *
 * Model: `claude-sonnet-5` — the documented drop-in replacement for the retired
 * `claude-sonnet-4-20250514` this code shipped with (retired 2026-06-15).
 */
import type { Recipe } from './types';
import { cleanText, durationToMinutes, formatMinutes, normalizeYield, groupIngredients, normalizeInstructions } from './normalize';
import { finalize } from './extract';

export const AI_MODEL = 'claude-sonnet-5';

/** Strip a page down to readable text so the prompt stays small and cheap. */
export function htmlToPlainText(html: string, maxChars = 24_000): string {
  let s = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Drop nav/footer/header/aside/form chrome when tagged.
    .replace(/<(nav|footer|header|aside|form)\b[\s\S]*?<\/\1>/gi, ' ');
  s = cleanText(s.replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\n{2,}/g, '\n'));
  // cleanText collapses newlines; re-insert light structure by sentence boundaries isn't needed for the model.
  return s.slice(0, maxChars);
}

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'title', 'ingredients', 'instructions', 'prepTime', 'cookTime', 'totalTime', 'servings', 'description'],
  properties: {
    found: { type: 'boolean', description: 'false if the page does not contain a cooking recipe' },
    title: { type: ['string', 'null'] },
    description: { type: ['string', 'null'], description: 'One-sentence description if present, else null' },
    ingredients: { type: 'array', items: { type: 'string' }, description: 'One ingredient per item, verbatim quantities. Include section headers as their own items ending with a colon, e.g. "For the sauce:"' },
    instructions: { type: 'array', items: { type: 'string' }, description: 'One step per item, verbatim wording, no numbering' },
    prepTime: { type: ['string', 'null'], description: 'e.g. "15 min", or null' },
    cookTime: { type: ['string', 'null'] },
    totalTime: { type: ['string', 'null'] },
    servings: { type: ['string', 'null'], description: 'e.g. "4 servings" or "12 cookies", or null' },
  },
} as const;

export interface AiExtractResult {
  recipe: Recipe | null;
  /** Rough token usage for observability. */
  usage?: { input: number; output: number };
}

/**
 * Ask Claude to pull the recipe out of page text. Returns null when the page has no recipe.
 * Never invents fields: quantities and steps must be verbatim from the page.
 */
export async function extractRecipeWithAi(html: string, apiKey: string, pageUrl?: string): Promise<AiExtractResult> {
  if (!apiKey) return { recipe: null };
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 });
  const text = htmlToPlainText(html);
  if (text.length < 200) return { recipe: null };

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: RECIPE_SCHEMA as any },
    },
    system:
      'You extract the single main cooking recipe from web page text. Copy ingredient lines and instruction steps verbatim from the page (fix only obvious spacing). Do not add, merge, paraphrase, or invent anything. If the page has no cooking recipe (an article, a category page, a shop), set found=false and leave the arrays empty.',
    messages: [
      {
        role: 'user',
        content: `Page URL: ${pageUrl ?? 'unknown'}\n\nPage text:\n${text}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') return { recipe: null };
  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') return { recipe: null };
  let parsed: any;
  try {
    parsed = JSON.parse(block.text);
  } catch {
    return { recipe: null };
  }
  const usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };
  if (!parsed?.found) return { recipe: null, usage };

  const ingredientGroups = groupIngredients(Array.isArray(parsed.ingredients) ? parsed.ingredients : []);
  const instructionGroups = normalizeInstructions(Array.isArray(parsed.instructions) ? parsed.instructions : []);
  const ingredients = ingredientGroups.flatMap((g) => g.items);
  const instructions = instructionGroups.flatMap((g) => g.items);
  if (!ingredients.length && !instructions.length) return { recipe: null, usage };

  const prepMinutes = durationToMinutes(parsed.prepTime);
  const cookMinutes = durationToMinutes(parsed.cookTime);
  let totalMinutes = durationToMinutes(parsed.totalTime);
  if (totalMinutes == null && (prepMinutes || cookMinutes)) totalMinutes = (prepMinutes || 0) + (cookMinutes || 0);
  const y = normalizeYield(parsed.servings);

  const recipe: Recipe = {
    title: cleanText(parsed.title) || 'Untitled Recipe',
    description: cleanText(parsed.description) || null,
    ingredients,
    instructions,
    prepTime: formatMinutes(prepMinutes),
    cookTime: formatMinutes(cookMinutes),
    totalTime: formatMinutes(totalMinutes),
    prepMinutes,
    cookMinutes,
    totalMinutes,
    servings: y.text,
    yieldCount: y.count,
    image: null,
    sourceUrl: pageUrl ?? null,
    extractedVia: 'ai',
  };
  if (ingredientGroups.some((g) => g.name)) recipe.ingredientGroups = ingredientGroups;
  return { recipe: finalize(recipe), usage };
}

/**
 * Turn a YouTube transcript into ordered steps for a known ingredient list.
 */
export async function instructionsFromTranscript(transcript: string, title: string, ingredients: string[], apiKey: string): Promise<string[]> {
  if (!apiKey || !transcript) return [];
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 });
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['steps'],
    properties: { steps: { type: 'array', items: { type: 'string' } } },
  } as const;
  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2500,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: schema as any } },
      system: 'You turn a cooking video transcript into clear, ordered cooking steps. Each step is one concise imperative sentence. Ignore intros, sponsor reads, and chatter. If no cooking instructions can be recovered, return an empty list.',
      messages: [
        {
          role: 'user',
          content: `Recipe: "${title}"\nIngredients: ${ingredients.slice(0, 20).join(', ')}\n\nTranscript:\n${transcript.slice(0, 14_000)}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') return [];
    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return [];
    const parsed = JSON.parse(block.text);
    return Array.isArray(parsed?.steps) ? parsed.steps.map((s: unknown) => cleanText(s)).filter(Boolean) : [];
  } catch {
    return [];
  }
}
