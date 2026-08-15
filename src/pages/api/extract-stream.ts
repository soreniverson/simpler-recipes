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
import { normalizeUrl } from '../../lib/url';
import { safeFetch, SafeFetchError } from '../../lib/safeFetch';
import { extractRecipeFromHtml, siteNameFromUrl } from '../../lib/recipe/extract';
import { extractRecipeWithAi } from '../../lib/recipe/ai';
import type { Recipe, ExtractionMethod } from '../../lib/recipe/types';
import { checkIpRateLimit, getClientIp } from '../../lib/limits';
import {
  getYouTubeVideoId,
  parseRecipeFromDescription,
  fetchYouTubeTranscript,
  fetchYouTubeVideoInfo,
} from '../../utils/recipeExtractor';
import { instructionsFromTranscript } from '../../lib/recipe/ai';

export const prerender = false;

/**
 * SSE protocol (event → data):
 *   progress      { step: string }
 *   complete      { recipe, cached?: boolean, method: ExtractionMethod, ms: number }
 *   usage         { current, limit, remaining, isLastFree, isAuthenticated }   (AI path only)
 *   limit_reached { message, current, limit, isAuthenticated, url }           (AI path only)
 *   error         { code, error: string (human), hint?: string, url?: string, status?: number }
 */

type ErrorCode =
  | 'invalid-url'
  | 'unsupported-scheme'
  | 'blocked-host'
  | 'dns-failed'
  | 'timeout'
  | 'http-error'
  | 'blocked-by-site'
  | 'not-found'
  | 'unsupported-content-type'
  | 'too-large'
  | 'network-error'
  | 'no-recipe'
  | 'rate-limited'
  | 'youtube-unavailable'
  | 'server-error';

interface UserFacingError {
  code: ErrorCode;
  error: string;
  hint?: string;
  status?: number;
}

/** Plain-English messages. No internals leak to the user. */
function describeFetchError(err: SafeFetchError, hostname: string): UserFacingError {
  switch (err.code) {
    case 'invalid-url':
    case 'unsupported-scheme':
      return { code: err.code, error: "That doesn't look like a web address.", hint: 'Paste the full link to the recipe page, starting with https://.' };
    case 'blocked-host':
      return { code: 'blocked-host', error: "That address can't be fetched.", hint: 'Only public recipe pages are supported.' };
    case 'dns-failed':
      return { code: 'dns-failed', error: `We couldn't find ${hostname}.`, hint: 'Check the address for typos and try again.' };
    case 'timeout':
      return { code: 'timeout', error: `${hostname} took too long to respond.`, hint: 'Try again in a moment, or open the original page.' };
    case 'too-many-redirects':
    case 'network-error':
      return { code: 'network-error', error: `We couldn't reach ${hostname}.`, hint: 'The site may be down. Try again in a moment.' };
    case 'unsupported-content-type':
      return { code: 'unsupported-content-type', error: "That link isn't a web page.", hint: 'Paste a link to the recipe page itself, not a file or image.' };
    case 'too-large':
      return { code: 'too-large', error: 'That page is too large to read.', hint: 'Try the direct link to the recipe.' };
    case 'http-error': {
      const status = err.status ?? 0;
      if (status === 404 || status === 410) return { code: 'not-found', status, error: "That page doesn't exist anymore.", hint: 'Check the link, or search for the recipe on the site.' };
      if (status === 401 || status === 403 || status === 429 || status === 451 || status === 503) {
        return { code: 'blocked-by-site', status, error: `${hostname} won't let us read that page.`, hint: 'Some sites block automated readers. You can still open the original.' };
      }
      return { code: 'http-error', status, error: `${hostname} returned an error (${status}).`, hint: 'Try again in a moment, or open the original page.' };
    }
    default:
      return { code: 'server-error', error: 'Something went wrong on our side.', hint: 'Please try again.' };
  }
}

function sendEvent(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ request }) => {
  const started = Date.now();
  const rawUrl = new URL(request.url).searchParams.get('url');
  if (!rawUrl) return json({ error: 'URL is required', code: 'invalid-url' }, 400);

  const normalized = normalizeUrl(rawUrl);
  if (!normalized.ok) {
    const msg =
      normalized.error === 'unsupported-scheme'
        ? 'Only http and https links are supported.'
        : "That doesn't look like a web address.";
    return json({ error: msg, code: normalized.error === 'unsupported-scheme' ? 'unsupported-scheme' : 'invalid-url' }, 400);
  }
  const url = normalized.url;
  let hostname = 'that site';
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* ignore */
  }

  const ip = getClientIp(request);
  // Only the anonymous cookie is read synchronously; everything that costs a round-trip
  // (rate limit, cache, auth) runs INSIDE the stream so the client sees progress immediately
  // instead of a blank 4–5s TTFB.
  const cookieToken = getTokenFromRequest(request);

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: unknown) => sendEvent(controller, event, data);
      // One structured line per extraction (hostname only, no user data) so Vercel logs can answer
      // "which sites fail, how often, and how slow is each path" without extra tooling.
      const logOutcome = (outcome: string, extra: Record<string, unknown> = {}) =>
        console.log(JSON.stringify({ event: 'extract', host: hostname, outcome, ms: Date.now() - started, ...extra }));
      const fail = (e: UserFacingError) => {
        logOutcome('error', { code: e.code, ...(e.status ? { status: e.status } : {}) });
        emit('error', { ...e, url });
      };
      const complete = (recipe: Recipe, method: ExtractionMethod, extra: Record<string, unknown> = {}) => {
        logOutcome('ok', { method, ...(extra.cached ? { cached: true } : {}), ingredients: recipe.ingredients.length, steps: recipe.instructions.length });
        emit('complete', { recipe, method, ms: Date.now() - started, ...extra });
      };

      // Identity for the AI quota; resolved lazily only when the AI path is reached.
      let userId: string | null | undefined;
      const identity = async () => {
        if (userId === undefined) userId = await getUserIdFromRequest(request);
        const isAuthenticated = !!userId;
        return { isAuthenticated, token: isAuthenticated ? (userId as string) : cookieToken ?? ip };
      };

      try {
        emit('progress', { step: `Fetching ${hostname}…` });

        // Abuse guard (fails open without KV) + cache, in parallel.
        const [rate, cached] = await Promise.all([checkIpRateLimit(ip), getCachedExtraction(url)]);
        if (rate.limited) {
          fail({ code: 'rate-limited', error: 'Too many requests from your network right now.', hint: `Try again in ${Math.ceil(rate.retryAfterSeconds / 60)} min.` });
          return;
        }
        if (cached?.recipe) {
          complete(cached.recipe, cached.recipe.extractedVia ?? 'unknown', { cached: true });
          return;
        }

        // Social/video apps serve login walls to servers; say so instead of "no recipe found".
        if (/(^|\.)(instagram\.com|tiktok\.com|pinterest\.[a-z.]+|facebook\.com|fb\.watch|x\.com|twitter\.com|threads\.net|snapchat\.com)$/i.test(hostname)) {
          fail({ code: 'blocked-by-site', error: `We can't read recipes from ${hostname} yet.`, hint: 'Look for a recipe link in the post or bio and paste that instead.' });
          return;
        }

        const videoId = getYouTubeVideoId(url);
        if (videoId) {
          const who = await identity();
          await handleYouTube(url, videoId, { emit, fail, complete, token: who.token, isAuthenticated: who.isAuthenticated });
          return;
        }

        // ---- 1. Fetch (SSRF-safe) ----
        let html: string;
        let finalUrl = url;
        try {
          const res = await safeFetch(url);
          html = res.body;
          finalUrl = res.url;
        } catch (err) {
          if (err instanceof SafeFetchError) {
            fail(describeFetchError(err, hostname));
            return;
          }
          throw err;
        }

        // ---- 2. Structured extraction (free) ----
        emit('progress', { step: 'Finding the recipe…' });
        const outcome = extractRecipeFromHtml(html, finalUrl);
        if (outcome.recipe) {
          await cacheExtraction(url, outcome.recipe);
          complete(outcome.recipe, outcome.method, { candidates: outcome.candidates });
          return;
        }

        // ---- 3. AI fallback (metered) ----
        const anthropicApiKey = import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        if (!anthropicApiKey) {
          fail({ code: 'no-recipe', error: `We couldn't find a recipe on that page.`, hint: 'Make sure the link goes to a specific recipe, not a category or search page.' });
          return;
        }
        const { token, isAuthenticated } = await identity();
        if (token) {
          const status = await hasReachedLimit(token, isAuthenticated);
          if (status.limited) {
            emit('limit_reached', {
              message: isAuthenticated
                ? "This page has no recipe data we can read directly, and you've used this month's AI extractions."
                : "This page has no recipe data we can read directly. You've used your free AI extractions — create a free account for 30 a month.",
              current: status.current,
              limit: status.limit,
              isAuthenticated,
              url,
            });
            return;
          }
        }
        emit('progress', { step: 'Reading the page more carefully…' });
        const ai = await extractRecipeWithAi(html, anthropicApiKey, finalUrl);
        if (!ai.recipe) {
          fail({ code: 'no-recipe', error: `We couldn't find a recipe on that page.`, hint: 'Make sure the link goes to a specific recipe, not a category or search page.' });
          return;
        }
        if (!ai.recipe.siteName) ai.recipe.siteName = siteNameFromUrl(finalUrl);
        await cacheExtraction(url, ai.recipe);
        await reportUsage(emit, token, isAuthenticated);
        complete(ai.recipe, 'ai');
      } catch (err) {
        console.error('[extract] unexpected', err);
        fail({ code: 'server-error', error: 'Something went wrong on our side.', hint: 'Please try again.' });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};

async function reportUsage(emit: (e: string, d: unknown) => void, token: string | null, isAuthenticated: boolean) {
  if (!token) return;
  const newCount = await incrementExtraction(token, isAuthenticated);
  const limit = isAuthenticated ? AUTHENTICATED_EXTRACTION_LIMIT : ANONYMOUS_EXTRACTION_LIMIT;
  const remaining = Math.max(0, limit - newCount);
  emit('usage', { current: newCount, limit, remaining, isLastFree: !isAuthenticated && remaining === 0, isAuthenticated });
}

interface Ctx {
  emit: (e: string, d: unknown) => void;
  fail: (e: UserFacingError) => void;
  complete: (recipe: Recipe, method: ExtractionMethod, extra?: Record<string, unknown>) => void;
  token: string | null;
  isAuthenticated: boolean;
}

async function handleYouTube(url: string, videoId: string, ctx: Ctx) {
  const youtubeApiKey = import.meta.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
  const anthropicApiKey = import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!youtubeApiKey) {
    ctx.fail({ code: 'youtube-unavailable', error: "YouTube links aren't available right now.", hint: 'Paste the recipe link from the video description instead.' });
    return;
  }
  ctx.emit('progress', { step: 'Fetching video info…' });
  const info = await fetchYouTubeVideoInfo(videoId, youtubeApiKey);
  if (!info) {
    ctx.fail({ code: 'not-found', error: "We couldn't find that video.", hint: 'Check the link and try again.' });
    return;
  }
  ctx.emit('progress', { step: 'Reading the description…' });
  const { ingredients, instructions, recipeLink } = parseRecipeFromDescription(info.description);
  let finalIngredients = ingredients;
  let finalInstructions = instructions;
  let recipe: Recipe | null = null;

  if (ingredients.length === 0 && recipeLink) {
    ctx.emit('progress', { step: 'Following the recipe link…' });
    try {
      const linked = await safeFetch(recipeLink);
      const out = extractRecipeFromHtml(linked.body, linked.url);
      if (out.recipe) recipe = out.recipe;
      else if (anthropicApiKey) {
        const ai = await extractRecipeWithAi(linked.body, anthropicApiKey, linked.url);
        if (ai.recipe) recipe = ai.recipe;
      }
    } catch {
      /* fall through to transcript path */
    }
  }

  if (!recipe && finalIngredients.length > 0 && finalInstructions.length === 0 && anthropicApiKey) {
    ctx.emit('progress', { step: 'Watching the video for steps…' });
    const transcript = await fetchYouTubeTranscript(videoId);
    if (transcript) finalInstructions = await instructionsFromTranscript(transcript, info.title, finalIngredients, anthropicApiKey);
  }

  if (!recipe) {
    if (!finalIngredients.length && !finalInstructions.length) {
      ctx.fail({ code: 'no-recipe', error: "We couldn't find a recipe for that video.", hint: 'Look for a recipe link in the video description and paste that instead.' });
      return;
    }
    recipe = {
      title: info.title,
      description: null,
      ingredients: finalIngredients,
      instructions: finalInstructions,
      prepTime: null,
      cookTime: null,
      totalTime: null,
      servings: null,
      yieldCount: null,
      image: info.thumbnail,
      sourceUrl: url,
      siteName: 'YouTube',
      source: 'youtube',
      extractedVia: 'youtube',
    };
  } else {
    recipe.image = recipe.image || info.thumbnail;
    recipe.sourceUrl = recipe.sourceUrl || url;
  }

  await cacheExtraction(url, recipe);
  ctx.complete(recipe, recipe.extractedVia ?? 'youtube');
}
