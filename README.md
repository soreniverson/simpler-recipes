# Simpler Recipes

Paste any recipe URL. Get the recipe. Nothing else. — https://www.simpler.recipes

Astro 5 (static pages + a few `prerender = false` API routes on Vercel) with React islands, Tailwind, Vitest.

## Run

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static build + Vercel functions (also builds search-index.json with thumbnails)
npm test           # vitest (parser, scaling, storage, URL/SSRF, corpus fixtures)
npm run check      # tsc --noEmit + astro check
```

Optional env (the app degrades gracefully without them): server store (below), `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (AI fallback + remix), `YOUTUBE_API_KEY`, `SKIP_IMAGE_OPT=1` (skip build-time image optimisation).

## Server store (share links, extraction cache, AI quotas, rate limits)

`src/lib/serverStore.ts` needs ONE of two backends in production; without one, sharing returns 503, cache/rate-limits are off, and the metered AI paths refuse (fail closed) rather than run unmetered:

- **Redis** — attach a Redis store via Vercel Marketplace (Storage tab); `KV_REST_API_URL`/`KV_REST_API_TOKEN` auto-populate. No code or schema needed. Preferred when configured.
- **Supabase** — run `supabase-kv-migration.sql` once in the Supabase SQL Editor, then set `SUPABASE_SERVICE_ROLE_KEY` in Vercel (URL comes from `PUBLIC_SUPABASE_URL`). If stale `KV_REST_API_*` vars still exist, either delete them or set `SERVER_STORE=supabase` to override.

Backend failures are logged as one JSON line (`{"event":"store-error",...}` / `"store-unconfigured"`) — grep Vercel logs for `store-` to see if protection is actually running. To verify after a deploy: `POST https://www.simpler.recipes/api/share` with `{"recipe":{...}}` should return `{"id":"..."}`.

## Where things live

| Area | Path |
|---|---|
| Extraction pipeline (JSON-LD → microdata → DOM → Claude), normalisation, scaling, display | `src/lib/recipe/` |
| SSRF-safe fetch, URL normalisation, rate limits | `src/lib/safeFetch.ts`, `src/lib/url.ts`, `src/lib/limits.ts` |
| Local-first storage: recent recipes, cook state, timers | `src/lib/recentRecipes.ts`, `src/lib/cookState.ts`, `src/lib/timerStore.js` |
| Extraction API (SSE) / share / remix | `src/pages/api/` |
| Recipe page (curated, extracted, shared share one renderer) | `src/components/recipe/RecipeView.jsx` (+ `Ingredients`, `Instructions`, `CookMode`, `Timers`) |
| Paste-or-search box | `src/components/SmartInput.jsx` |
| Curated catalog (source of truth) + browse page definitions | `recipe-data/all-recipes.json`, `src/lib/browse.ts` |
| Data cleanup (idempotent) | `npx tsx scripts/normalize-data.ts [--dry]` |
| Design tokens, buttons, print CSS | `src/layouts/BaseLayout.astro` |
| Tests + 52 real-site JSON-LD fixtures | `tests/`, `tests/fixtures/jsonld/` |

## Principles (short)

Structured data first; AI only when a page has none. Never invent data (no fabricated schema, no default "4 servings"). Extracted recipes stay on the device unless shared. Every recipe links back to its source. Homepage never becomes "sign in to continue".

See `OVERNIGHT_REPORT.md` for the 2026-08-15 state of the product and `OVERNIGHT_AUDIT.md` for the log.
