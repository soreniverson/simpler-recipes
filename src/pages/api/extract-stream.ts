import type { APIRoute } from 'astro';
import {
  getCachedExtraction,
  cacheExtraction,
  hasReachedLimit,
  incrementExtraction,
  ANONYMOUS_EXTRACTION_LIMIT,
  AUTHENTICATED_EXTRACTION_LIMIT,
} from '../../utils/kv';
import { getTokenFromRequest } from '../../utils/anonymousToken';
import { getUserIdFromRequest } from '../../utils/supabase';
import {
  getYouTubeVideoId,
  extractJsonLdScripts,
  findRecipeInJsonLd,
  parseRecipeFromJsonLd,
  parseRecipeFromDescription,
  fetchYouTubeTranscript,
  fetchPage,
  fetchYouTubeVideoInfo,
  extractWithClaude,
  extractInstructionsFromTranscript,
  decodeHtmlEntities,
  parseInstructions,
  type ExtractedRecipe,
} from '../../utils/recipeExtractor';

export const prerender = false;

// Helper to send SSE message
function sendEvent(controller: ReadableStreamDefaultController, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url).searchParams.get('url');

  if (!url) {
    return new Response(JSON.stringify({ error: 'URL is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate URL
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check cache first - cached results don't count against limit
  const cached = await getCachedExtraction(url);

  // Check if user is authenticated
  const userId = await getUserIdFromRequest(request);
  const isAuthenticated = !!userId;

  // Get token for rate limiting (use userId if authenticated, otherwise anonymous token)
  const token = isAuthenticated ? userId : getTokenFromRequest(request);

  // If not cached, check extraction limit
  let limitReached = false;
  let limitStatus = null;
  if (!cached && token) {
    limitStatus = await hasReachedLimit(token, isAuthenticated);
    limitReached = limitStatus.limited;
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Check if limit reached (send as SSE so client can handle it)
        if (limitReached && limitStatus) {
          const message = isAuthenticated
            ? 'You\'ve reached your monthly extraction limit. Your limit resets next month.'
            : 'You\'ve used all your free extractions. Create a free account to get 30 extractions per month.';
          sendEvent(controller, 'limit_reached', {
            message,
            current: limitStatus.current,
            limit: limitStatus.limit,
            isAuthenticated,
          });
          return;
        }

        if (cached) {
          sendEvent(controller, 'progress', { step: 'Found in cache!' });
          sendEvent(controller, 'complete', { recipe: cached.recipe, cached: true });
          return;
        }

        const videoId = getYouTubeVideoId(url);
        let success = false;

        if (videoId) {
          success = await handleYouTubeExtraction(controller, url, videoId);
        } else {
          success = await handleWebExtraction(controller, url);
        }

        // Increment extraction count only on successful extraction
        if (success && token) {
          const newCount = await incrementExtraction(token);
          const limit = isAuthenticated ? AUTHENTICATED_EXTRACTION_LIMIT : ANONYMOUS_EXTRACTION_LIMIT;
          const remaining = limit - newCount;

          // Include usage info in the complete event
          sendEvent(controller, 'usage', {
            current: newCount,
            limit,
            remaining: Math.max(0, remaining),
            isLastFree: !isAuthenticated && remaining === 0,
            isAuthenticated,
          });
        }
      } catch (err) {
        console.error('Extraction error:', err);
        sendEvent(controller, 'error', { error: 'Failed to extract recipe' });
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

async function handleYouTubeExtraction(
  controller: ReadableStreamDefaultController,
  url: string,
  videoId: string
): Promise<boolean> {
  const youtubeApiKey = import.meta.env.YOUTUBE_API_KEY;
  const anthropicApiKey = import.meta.env.ANTHROPIC_API_KEY;

  if (!youtubeApiKey) {
    sendEvent(controller, 'error', { error: 'YouTube API not configured' });
    return false;
  }

  // Step 1: Fetch video info
  sendEvent(controller, 'progress', { step: 'Fetching video info...' });
  const videoInfo = await fetchYouTubeVideoInfo(videoId, youtubeApiKey);

  if (!videoInfo) {
    sendEvent(controller, 'error', { error: 'Video not found' });
    return false;
  }

  const { title, description, thumbnail } = videoInfo;

  // Step 2: Parse description
  sendEvent(controller, 'progress', { step: 'Parsing description...' });
  const { ingredients, instructions, recipeLink } = parseRecipeFromDescription(description);

  let finalIngredients = ingredients;
  let finalInstructions = instructions;

  // Step 3: If no ingredients but has recipe link, follow it
  if (ingredients.length === 0 && recipeLink) {
    sendEvent(controller, 'progress', { step: 'Fetching linked recipe...' });

    const linkedHtml = await fetchPage(recipeLink);
    if (linkedHtml) {
      const jsonLdScripts = extractJsonLdScripts(linkedHtml);
      let recipeSchema = null;
      for (const script of jsonLdScripts) {
        recipeSchema = findRecipeInJsonLd(script);
        if (recipeSchema) break;
      }

      if (recipeSchema?.recipeIngredient?.length) {
        finalIngredients = recipeSchema.recipeIngredient.map(decodeHtmlEntities);
        finalInstructions = parseInstructions(recipeSchema.recipeInstructions).map(decodeHtmlEntities);
      } else if (anthropicApiKey) {
        sendEvent(controller, 'progress', { step: 'Extracting with AI...' });
        const claudeRecipe = await extractWithClaude(linkedHtml, anthropicApiKey);
        if (claudeRecipe) {
          finalIngredients = claudeRecipe.ingredients || [];
          finalInstructions = claudeRecipe.instructions || [];
        }
      }
    }
  }

  // Step 4: If we have ingredients but no instructions, get from transcript
  if (finalIngredients.length > 0 && finalInstructions.length === 0 && anthropicApiKey) {
    sendEvent(controller, 'progress', { step: 'Fetching video transcript...' });
    const transcript = await fetchYouTubeTranscript(videoId);

    if (transcript) {
      sendEvent(controller, 'progress', { step: 'Extracting instructions from video...' });
      finalInstructions = await extractInstructionsFromTranscript(
        transcript,
        title,
        finalIngredients,
        anthropicApiKey
      );
    }
  }

  const recipe: ExtractedRecipe = {
    title,
    ingredients: finalIngredients,
    instructions: finalInstructions,
    prepTime: null,
    cookTime: null,
    servings: null,
    image: thumbnail,
    source: 'youtube',
  };

  // Cache successful extraction
  if (recipe.ingredients.length > 0 || recipe.instructions.length > 0) {
    await cacheExtraction(url, recipe);
  }

  sendEvent(controller, 'complete', { recipe });
  return true;
}

async function handleWebExtraction(controller: ReadableStreamDefaultController, url: string): Promise<boolean> {
  const anthropicApiKey = import.meta.env.ANTHROPIC_API_KEY;

  // Step 1: Fetch page
  sendEvent(controller, 'progress', { step: 'Fetching page...' });
  const html = await fetchPage(url);

  if (!html) {
    sendEvent(controller, 'error', { error: 'Failed to fetch page' });
    return false;
  }

  // Step 2: Try JSON-LD extraction
  sendEvent(controller, 'progress', { step: 'Looking for recipe data...' });

  const jsonLdScripts = extractJsonLdScripts(html);
  let recipeSchema = null;
  for (const script of jsonLdScripts) {
    recipeSchema = findRecipeInJsonLd(script);
    if (recipeSchema) break;
  }

  let recipe = parseRecipeFromJsonLd(recipeSchema);

  // Step 3: If no schema or incomplete, use Claude
  if (!recipe && anthropicApiKey) {
    sendEvent(controller, 'progress', { step: 'Extracting with AI...' });

    const claudeRecipe = await extractWithClaude(html, anthropicApiKey);
    if (claudeRecipe && (claudeRecipe.ingredients?.length || claudeRecipe.instructions?.length)) {
      recipe = {
        title: claudeRecipe.title || 'Untitled Recipe',
        ingredients: claudeRecipe.ingredients || [],
        instructions: claudeRecipe.instructions || [],
        prepTime: claudeRecipe.prepTime || null,
        cookTime: claudeRecipe.cookTime || null,
        servings: claudeRecipe.servings || null,
        image: null,
      };
    }
  }

  if (!recipe) {
    sendEvent(controller, 'error', { error: 'Could not extract recipe from this page' });
    return false;
  }

  // Cache successful extraction
  await cacheExtraction(url, recipe);

  sendEvent(controller, 'complete', { recipe });
  return true;
}
