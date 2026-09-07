# Search spike — audit & decisions (2026-09-06)

## Baseline (before this spike)

- **Stack**: Astro 5 static output + a few `prerender=false` API/dynamic routes on Vercel; React islands; GA4 (`G-RJR6YF1HVL`) loaded post-idle; `@astrojs/sitemap`.
- **Catalog**: 227 public curated recipes in `recipe-data/all-recipes.json`. Coverage: totalTime 224/227, prepTime 219, cookTime 208, image 227, servings 227, source attribution 227, tags 225, instructions/ingredients 227. 0 duplicate slugs; 2 duplicate titles (`French Toast` ×2, `Chicken Stir Fry` ×2 — distinct recipes from different sources; flagged for editorial reconciliation, not blocking).
- **Already good** (no work needed beyond reuse):
  - `/recipes/[slug]` pages emit honest Recipe + BreadcrumbList JSON-LD (no fabricated ratings/nutrition/dates, `<`-escaped serialization, `isBasedOn` + Organization author credit).
  - `/browse/[slug]` pages emit CollectionPage + ItemList + BreadcrumbList; crawlable server HTML for all cards.
  - Client shells (`/recipe`, `/shared`, `/r/*`, `/favorites`, `/pantry`, `/plan`, `/404`) are `noindex`.
  - robots.txt disallows `/api/`, `/auth/`; points at sitemap-index.
- **Publication rules**: only the curated catalog is public. User extractions stay on-device; shared recipes (`/r/*`, `/shared`) are noindex and out of the sitemap. Nothing in this spike widens exposure of private/imported data.
- **Gaps found**: sitemap `lastmod` was the build timestamp for every URL; `/shared` shell not in the sitemap filter (moot for static builds — it's server-rendered — but now excluded explicitly); no funnel analytics events; no tool/editorial/comparison surfaces; registry had no intent/family/date metadata.

## What shipped

1. **Registry extension** (`src/lib/browse.ts`): every page now carries `intent`, `family`, `published`, optional `seasonal`. Same `MIN_RECIPES = 8` gate (kept stricter than the brief's 6). Deterministic build (pure matchers, stable sort).
2. **15 new collections** (35 live total): shrimp, rice-dishes, one-pot, breakfast, baking, party-food, grilling, indian, italian, asian, mediterranean, mexican, chicken-and-rice, potatoes, healthy-dinners. Two defined-but-gated (pork, eggs) auto-launch if coverage arrives. 11 drafts with reasons in `launch-manifest.json`.
3. **Sitemap honesty** (`astro.config.mjs`): per-URL lastmod from real dates (recipe `addedDate`, collection `published`/newest member, page registry `updated`); URLs without a known date get **no** lastmod instead of a fake one.
4. **Tool page** `/recipe-cleaner/` and **editorial** `/why-recipe-sites-have-long-stories/` (sourced; see sources.md).
5. **Comparisons** `/alternatives/just-the-recipe/` and `/compare/simpler-vs-paprika/` — verdict-first, sourced, checked-date shown, explicit about where the competitor wins; unknowns stated as "not listed", never "No".
6. **Seasonal**: same registry + `seasonal` metadata (soup, baking, party-food, grilling, healthy-dinners); rolling calendar in `seasonal-calendar.csv`; `npm run search:report` prints next-90-day tasks and regenerates the manifest. **Honest gap**: zero Thanksgiving coverage in the catalog — no page forced.
7. **Funnel analytics** (`src/lib/track.js`): `clean_start` / `clean_success` (actual SSE outcome, method, cached) / `clean_error` (sanitized code) / `recipe_card_open` (slug). Route pathname only; never pasted URLs. Success is emitted on the server's `complete` event, not form submission.
8. **Product entry points**: compact CleanBox on every browse collection + all four new pages, reusing the existing extraction flow (rate limits, quotas, errors included — no second extractor).

## Decisions & tradeoffs

- Extended the existing browse system instead of a parallel "SEO engine" — one registry drives routes, index page, sitemap, calendar, manifest.
- `15-minute-meals` consolidated into `/browse/20-minute-recipes/` (same experience → one intent, per the doorway-page guardrail).
- No "chicken without ads" duplicate pages; the ad-free framing lives in metadata/descriptions of the one canonical page per intent.
- Search-volume claims: none made. Prioritization was qualitative intent × catalog coverage (per brief; no keyword tooling available).
- `aggregateRating`, nutrition, video, and rating markup: intentionally absent (no provenance).

## Known limitations / follow-ups

- Rich Results Test not run (external tool; local JSON-LD validation only — parse + required-field checks in the crawl). Named follow-up in qa.md.
- Duplicate-title pairs (`french-toast`, `chicken-stir-fry`) should be reconciled editorially.
- Catalog has no Thanksgiving/turkey coverage: biggest seasonal gap (see calendar).
- `/browse/` index and homepage carry no lastmod (no meaningful content date) — acceptable.
