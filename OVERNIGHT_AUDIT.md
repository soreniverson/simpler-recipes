# Overnight Audit — Simpler Recipes (2026-08-14/15)

Internal work log. Not part of the product. Compressed into a report at the end.

## 0. State on arrival

- HEAD `7c25b0c` (Jan 19 2026) == origin/main == what's live at https://www.simpler.recipes (Astro 5 + React islands, Vercel adapter, `output: 'static'` with `prerender=false` API routes).
- Working tree contained ~15 untracked/modified files (Vite SPA skeleton: `index.html`, `vite.config.js`, `src/App.jsx`, `api/extract.js`, …). Every one is **byte-identical to the initial commit `ca93e06`** — a Feb 8 restore of the v0 skeleton, not new work. Stashed as `stash@{0}` ("pre-overnight: stale Vite skeleton files…") so nothing is lost; working tree restored to HEAD.
- No local `.env` — locally KV/Supabase/Anthropic/YouTube are unconfigured; code degrades (cache miss, no limits, no AI fallback).
- Build: `npm run build` OK in ~6s. 228 curated recipes, 16 collections, static recipe pages at `/recipes/[slug]`.

## 1. Discoveries (running list)

### SEO / discovery
- [BUG] Recipe JSON-LD never renders: `recipes/[slug].astro` uses `<Fragment slot="head">` but `BaseLayout` has no named `head` slot. 0 `ld+json` on built and live pages.
- [BUG] `/robots.txt` → 404 on live.
- [BUG] `og:image` → `/og-default.png` → 404 on live. Every share preview is broken.
- [BUG] Sitemap lists `/auth/callback/`, `/favorites/`, `/pantry/`, `/plan/`, `/recipe/` (client-only shells) as indexable.
- [ISSUE] `simpler.recipes` 307→ `www.simpler.recipes`, but canonical/og:url/sitemap all use apex. Canonical points at a redirecting URL.
- [ISSUE] Recipe page title template: `"{title} - Simpler Recipes"`; description is a mechanical "Prep: X. Cook: Y. Serves Z."
- [ISSUE] Collection pages have no ItemList / BreadcrumbList schema. Recipe pages have no breadcrumbs.

### Extraction / parser
- Baseline 20 real URLs (local dev): 13 succeed, 4 were my own 404 URLs, 1 real miss (loveandlemons.com — 200 but "no recipe"), all under 1.5s.
- [BUG] `parseDuration` only handles `PT…`; Food Network emits `P0Y0M0DT0H15M0.000S` → shown raw to user.
- [BUG] `PT150M` → "150 min" (should be "2 hr 30 min"). Also "1 hrs" pluralization.
- [BUG] Yield strings not normalized: "4 serving(s)", "6 servings", "Cuts into 10 slices" → UI renders "4 serving(s) servings".
- [ISSUE] UA is `Mozilla/5.0 (compatible; SimplerRecipes/1.0)`; no timeout, no size cap, no redirect validation.
- [SECURITY] `fetchPage` has **no SSRF protection**: `http://169.254.169.254/`, `http://localhost:…`, private ranges all fetchable. Redirects followed blindly.
- [ISSUE] `findRecipeInJsonLd` returns first Recipe; ignores `@type` case, ignores `mainEntity`, doesn't prefer the one with ingredients.
- [ISSUE] `decodeHtmlEntities` misses many named entities (`&deg;`, `&frac12;`, `&eacute;`, `&rsquo;` …).
- [ISSUE] `parseInstructions` drops HowToSection names (grouping lost); doesn't strip HTML tags inside step text.
- [ISSUE] Ingredient sections lost entirely (schema has no sections but many sites embed "For the sauce:" as an ingredient line).

### Product / UX
- Anonymous users: **3 extractions lifetime**, then must create an account (30/mo). Enforced via a localStorage UUID cookie (trivially reset). This gates the core utility; conflicts with "no account needed". JSON-LD extraction has ~zero marginal cost; only the Claude fallback costs money.
- Homepage: hero image is a 1.18MB PNG. Example-recipe text cycles every 3s (motion; not reduced-motion aware).
- Recipe pages (`/recipes/[slug]` and `/recipe`): desktop = instructions LEFT, ingredients in right sticky sidebar. Mobile DOM order = image → title → **instructions → ingredients**. Wrong order for cooking.
- Ingredients: no check-off. Instructions: no check-off. Both `text-sm`.
- Servings scaler defaults to 4 when yield unknown → scaling from a fake baseline.
- Cook Mode: one step at a time, wake lock, keyboard nav; no ingredients access, no timers, no swipe, no step memory, exit loses place.
- Search: Fuse over `search-index.json` (174KB); dropdown results are `<a role="option">` with no arrow-key navigation; Cmd+K only focuses.
- Header on every page: Favorites, Meal Plan, Pantry, Settings(+Sign in). Heavy for a utility.
- Extracted recipe lives only in `localStorage['simpler-recipes-extracted']` → `/recipe` (client:only). Reload OK; opening a 2nd extraction overwrites; no history.

### Performance
- Two full Tailwind CSS files (~57KB) on every page (`callback.*.css` + `_slug_.*.css`).
- `index.*.js` 134KB main chunk; Header is `client:load` on every page and drags SmartInput + AuthModal + supabase.
- Google Fonts (Geist) render-blocking stylesheet from googleapis.
- Hero PNG 1.18MB.

### Data quality
- `appetizers-party` collection lists `spinach-artichoke-dip` twice.

### Code quality
- Collection icon SVG map duplicated 3× (`index.astro`, `collection/[slug].astro`, `collectionIcons.jsx`).
- `parseDuration/parseInstructions/parseImage/parseYield/findRecipeInJsonLd` duplicated between `recipeParser.js`, `recipeExtractor.ts`, `mcp-server/src/utils/recipe-parser.ts`, and (stash) `api/extract.js`.
- SSE client listens on event name `error`, which collides with EventSource's native `error` event.
- `usageInfo?.isLastFree` read inside `complete` handler = stale closure.
- No tests. No lint. No typecheck script.

## 2. Decisions (with reasons)

- **Structured extraction is free; only the AI fallback is metered.** JSON-LD/microdata parsing costs nothing; the old "3 lifetime then sign in" gate was on the wrong thing. Anonymous AI fallbacks stay at 3 (cookie token, IP fallback so a cleared cookie doesn't reset it); signed-in users 30/month. Homepage never becomes "sign in to continue". *Reversible: constants in `src/utils/kv.ts` / `extract-stream.ts`.*
- **Extracted recipes stay on-device.** `/recipe?r=<id>` reads a local "recent" store (up to 30 entries, migrated from the single legacy slot). Sharing is opt-in and creates a server copy at `/r/<id>` (noindex, canonical → source). No account needed for any of it.
- **One recipe component (`RecipeView`) for curated / extracted / shared.** Previously three divergent renderers with different bugs. Ingredients first in DOM (mobile order matches cooking); sticky aside on desktop.
- **Cook Mode is the primary hands-free surface.** Step memory (24h), swipe/keys, detected timers, ingredient sheet, wake lock, long-step layout. Kept the button off the desktop layout where the two-column view already works.
- **Scaling is honest.** Only detected quantities scale; unit ranges/oddities left alone; kitchen-friendly rounding; "×2" is a display transform, original always one tap away. When yield is unknown we don't invent "4".
- **www is canonical.** Live host 307s apex→www; every canonical/og/sitemap URL now says www. *Founder may prefer apex — one constant (`SITE_URL`) + Vercel domain setting.*
- **Programmatic pages are few and hand-introduced.** 20 browse definitions, each with a hand-written intro; any page under 8 recipes is dropped at build (currently all 20 pass, 8–139 recipes each). No tag soup, no ingredient×cuisine matrix.
- **No fabricated schema.** Recipe JSON-LD only carries fields we actually have (no ratings, nutrition, publish dates). Attribution: `author`=source org, `isBasedOn`=source URL.
- **Images are proxied at build, not runtime.** Astro image service resizes remote originals to WebP once at build (preflight fetch guards redirects/non-images). No runtime image proxy (cost, abuse surface). Extracted recipes still show remote images with `referrerpolicy=no-referrer`.
- **Model**: `claude-sonnet-4-20250514` (retired 2026-06-15 — the AI path had been silently 404ing) → `claude-sonnet-5` with structured outputs (`output_config.format: json_schema`) so the fallback can't return malformed JSON.
- **Auth cookie bridge** (`sr_auth`) rather than moving auth to SSR: supabase-js keeps the session in localStorage, so the server never saw a user and every signed-in user was metered as anonymous. Client mirrors the access token into a cookie; server verifies it with Supabase. Smallest change that fixes quotas and sync identity.
- **Deferred (not done tonight):** Astro 6/7 upgrade (breaking; advisories remain on astro 5.18.2 / @astrojs/vercel 9.0.5), DNS pinning via undici for the SSRF fetch (current: resolve → check → fetch; small TOCTOU window), AllRecipes/Dotdash datacenter-IP blocking (needs a residential proxy — a paid service, not configured), sync merge semantics (tombstones) for favorites/meal plan.
- **Reversible design change to flag:** favicon changed from the 🍳 emoji SVG to a list-mark that matches the app icons/manifest.

## 3. Measurements

**Lighthouse, mobile simulation** (production before = live www.simpler.recipes on 2026-08-14; after = local `astro build` served statically — same HTML/CSS/JS Vercel serves, but local network, so treat perf as an upper bound until deployed):

| Page | Perf before → after | A11y | Best practices | SEO |
|---|---|---|---|---|
| Home | 69 → 95 | 100 | 100 | 100 |
| Recipe (`/recipes/chicken-tikka-masala/`) | 75 → 92 | 100 | 100 | 100 |
| Collection | 71 → 86 | 100 | 100 | 100 |

**Payload**: home HTML+CSS+JS ≈ 1.6MB (1.18MB hero PNG + 2×57KB Tailwind + Google Fonts + 134KB main chunk) → hero removed, one Tailwind file (inlined), self-hosted Geist (2 woff2), main chunk split; RecipeView island 36KB→14.8KB gz after moving `entities`/`zod` out of the client path. Collection page images 2.6MB (hotlinked originals) → build-time WebP at 480×360.

**Extraction**: 70-URL real-site corpus audit → fixes; 52 JSON-LD fixtures under `tests/fixtures/jsonld` assert title/ingredients/instructions/times/yield per site. Time-to-first-SSE-byte moved from after rate-limit/cache/auth (~300–900ms of KV/Supabase round-trips) to immediate.

**Tests**: 0 → 182 (vitest, 9 files: url, safeFetch, normalize, extract, storage, timers, scale, corpus, browse). `npx tsc --noEmit` and `astro check`: 0 errors (was 54 in `astro check`).

**Pages**: 228 recipe pages + 16 collections + 20 browse pages + home; sitemap excludes client-only shells and auth callback.
