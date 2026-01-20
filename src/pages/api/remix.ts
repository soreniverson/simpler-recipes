import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedRecipe } from '../../utils/recipeExtractor';

export const prerender = false;

// Helper to send SSE message
function sendEvent(controller: ReadableStreamDefaultController, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

interface RemixRequest {
  baseRecipe: ExtractedRecipe;
  secondRecipe?: ExtractedRecipe;
  prompt?: string;
}

export const POST: APIRoute = async ({ request }) => {
  const anthropicApiKey = import.meta.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: RemixRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { baseRecipe, secondRecipe, prompt } = body;

  if (!baseRecipe) {
    return new Response(JSON.stringify({ error: 'Base recipe is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!secondRecipe && !prompt) {
    return new Response(JSON.stringify({ error: 'Either a second recipe or a prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        sendEvent(controller, 'progress', { step: 'Analyzing recipes...' });

        const client = new Anthropic({ apiKey: anthropicApiKey });

        // Build the prompt based on what we have
        let systemPrompt = `You are a creative chef AI that combines recipes or modifies them based on user requests.
You create coherent, delicious recipes that blend techniques, flavors, and ingredients in interesting ways.
Always return valid JSON with no markdown formatting or explanation.`;

        let userPrompt: string;

        if (secondRecipe) {
          // Combining two recipes
          sendEvent(controller, 'progress', { step: 'Combining recipes...' });
          userPrompt = `Combine these two recipes into a creative new dish that takes the best elements from both:

RECIPE 1: "${baseRecipe.title}"
Ingredients: ${baseRecipe.ingredients.join(', ')}
Instructions: ${baseRecipe.instructions.join(' ')}

RECIPE 2: "${secondRecipe.title}"
Ingredients: ${secondRecipe.ingredients.join(', ')}
Instructions: ${secondRecipe.instructions.join(' ')}

Create a new recipe that thoughtfully blends these dishes. The result should be a cohesive, delicious recipe - not just ingredients thrown together.

Return ONLY valid JSON with this exact structure:
{
  "title": "Creative name for the combined dish",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount", ...],
  "instructions": ["step 1", "step 2", ...],
  "prepTime": "X mins" or null,
  "cookTime": "X mins" or null,
  "servings": "X" or null
}`;
        } else {
          // Modifying based on prompt
          sendEvent(controller, 'progress', { step: 'Remixing recipe...' });
          userPrompt = `Modify this recipe based on the user's request:

ORIGINAL RECIPE: "${baseRecipe.title}"
Ingredients: ${baseRecipe.ingredients.join(', ')}
Instructions: ${baseRecipe.instructions.join(' ')}
${baseRecipe.servings ? `Servings: ${baseRecipe.servings}` : ''}

USER REQUEST: "${prompt}"

Create a modified version of this recipe that fulfills the user's request while keeping the dish recognizable and delicious.

Return ONLY valid JSON with this exact structure:
{
  "title": "Name for the modified dish",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount", ...],
  "instructions": ["step 1", "step 2", ...],
  "prepTime": "X mins" or null,
  "cookTime": "X mins" or null,
  "servings": "X" or null
}`;
        }

        sendEvent(controller, 'progress', { step: 'Generating new recipe...' });

        const message = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: userPrompt
          }],
          system: systemPrompt
        });

        const content = message.content[0];
        if (content.type !== 'text') {
          sendEvent(controller, 'error', { error: 'Unexpected response format' });
          return;
        }

        let recipe: ExtractedRecipe;
        try {
          const parsed = JSON.parse(content.text);
          recipe = {
            title: parsed.title || 'Remixed Recipe',
            ingredients: parsed.ingredients || [],
            instructions: parsed.instructions || [],
            prepTime: parsed.prepTime || null,
            cookTime: parsed.cookTime || null,
            servings: parsed.servings || null,
            image: null, // Remixed recipes don't have images
            source: 'remix',
          };
        } catch {
          sendEvent(controller, 'error', { error: 'Failed to parse recipe' });
          return;
        }

        if (recipe.ingredients.length === 0 || recipe.instructions.length === 0) {
          sendEvent(controller, 'error', { error: 'Generated recipe is incomplete' });
          return;
        }

        sendEvent(controller, 'complete', { recipe });
      } catch (err) {
        console.error('Remix error:', err);
        sendEvent(controller, 'error', { error: 'Failed to remix recipe' });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};
