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

Optional env (the app degrades gracefully without them): `KV_REST_API_URL`/`KV_REST_API_TOKEN` (cache, quotas, share), `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (AI fallback + remix), `YOUTUBE_API_KEY`, `SKIP_IMAGE_OPT=1` (skip build-time image optimisation).

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
