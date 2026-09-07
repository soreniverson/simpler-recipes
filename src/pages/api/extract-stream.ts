import type { APIRoute } from 'astro';
import {
  getCachedExtraction,
  cacheExtraction,
  reserveAiUse,
  refundAiUse,
  type AiReservation,
} from '../../utils/kv';
import { getTokenFromRequest } from '../../utils/anonymousToken';
import { getUserIdFromRequest } from '../../utils/supabase';
import { normalizeUrl } from '../../lib/url';
import { safeFetch, SafeFetchError } from '../../lib/safeFetch';
import { extractRecipeFromHtml, siteNameFromUrl } from '../../lib/recipe/extract';
import { extractRecipeWithAi } from '../../lib/recipe/ai';
import type { Recipe, ExtractionMethod } from '../../lib/recipe/types';
import { checkIpRateLimit, getClientIp } from '../../lib/limits';

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
      if (status === 404 || status === 410) return { code: 'not-found', status, error: `We couldn't find that page on ${hostname} (${status}).`, hint: 'Check the link, or search for the recipe on the site.' };
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

        // Abuse guard (request-level; fails open without a store) + cache, in parallel.
        // AI spend is separately protected by the fail-closed reservation below.
        const [rate, cached] = await Promise.all([checkIpRateLimit(ip), getCachedExtraction(url)]);
        if (rate.limited) {
          fail({ code: 'rate-limited', error: 'Too many requests from your network right now.', hint: `Try again in ${Math.ceil(rate.retryAfterSeconds / 60)} min.` });
          return;
        }
        if (cached?.recipe) {
          complete(cached.recipe, cached.recipe.extractedVia ?? 'unknown', { cached: true });
          return;
        }

        // YouTube support was removed deliberately: it was the one extraction path that
        // reached the AI unmetered. Point people at the description link instead.
        if (/(^|\.)(youtube\.com|youtu\.be)$/i.test(hostname)) {
          fail({ code: 'blocked-by-site', error: "We can't read recipes from YouTube.", hint: 'Look for a recipe link in the video description and paste that instead.' });
          return;
        }

        // Social/video apps serve login walls to servers; say so instead of "no recipe found".
        if (/(^|\.)(instagram\.com|tiktok\.com|pinterest\.[a-z.]+|facebook\.com|fb\.watch|x\.com|twitter\.com|threads\.net|snapchat\.com)$/i.test(hostname)) {
          fail({ code: 'blocked-by-site', error: `We can't read recipes from ${hostname} yet.`, hint: 'Look for a recipe link in the post or bio and paste that instead.' });
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
        // Reserve the AI slot ATOMICALLY before spending money (no check-then-spend
        // race). Fails closed in prod when the store is missing or erroring.
        const { token, isAuthenticated } = await identity();
        const reservation = await reserveAiUse(token, isAuthenticated, ip);
        if (!reservation.ok) {
          if (reservation.reason === 'unavailable') {
            fail({ code: 'server-error', error: 'AI extraction is temporarily unavailable.', hint: 'Try again in a few minutes, or open the original page.' });
          } else {
            emit('limit_reached', {
              message:
                reservation.reason === 'ip-quota'
                  ? "This page has no recipe data we can read directly, and your network has used today's AI extractions. Try again tomorrow."
                  : isAuthenticated
                    ? "This page has no recipe data we can read directly, and you've used this month's AI extractions."
                    : "This page has no recipe data we can read directly. You've used your free AI extractions — create a free account for 30 a month.",
              current: reservation.current,
              limit: reservation.limit,
              isAuthenticated,
              url,
            });
          }
          return;
        }
        emit('progress', { step: 'Reading the page more carefully…' });
        let ai;
        try {
          ai = await extractRecipeWithAi(html, anthropicApiKey, finalUrl);
        } catch (err) {
          // The Anthropic call never completed — give the reserved slot back.
          await refundAiUse(token, isAuthenticated, ip);
          throw err;
        }
        if (!ai.recipe) {
          // The call ran and billed us; the slot stays spent.
          fail({ code: 'no-recipe', error: `We couldn't find a recipe on that page.`, hint: 'Make sure the link goes to a specific recipe, not a category or search page.' });
          return;
        }
        if (!ai.recipe.siteName) ai.recipe.siteName = siteNameFromUrl(finalUrl);
        await cacheExtraction(url, ai.recipe);
        reportUsage(emit, reservation, isAuthenticated);
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

function reportUsage(emit: (e: string, d: unknown) => void, reservation: Extract<AiReservation, { ok: true }>, isAuthenticated: boolean) {
  const { current, limit, remaining } = reservation;
  emit('usage', { current, limit, remaining, isLastFree: !isAuthenticated && remaining === 0, isAuthenticated });
}
