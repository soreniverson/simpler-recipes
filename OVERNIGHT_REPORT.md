# Simpler Recipes — Overnight Report (2026-08-14 → 15)

Everything below is committed locally on `main` (43 commits ahead of `origin/main` @ `7c25b0c`). **Nothing has been pushed or deployed** — production still runs the old code. See "Founder decisions" first.

## 1. Executive summary

The product now does what the tagline promises, end to end. Paste any recipe link and the recipe streams in fast (structured data first, AI only when a page has none, no sign-in gate), lands on a page built for cooking (ingredients first, check-off, honest scaling, hands-free Cook Mode with timers that actually ring), stays on your device under a real address, and can be shared. The curated catalog is properly indexable for the first time (recipe schema was never rendering; robots.txt/og-image were 404), 20 intent-based browse pages were added, and every page moved from Lighthouse mobile perf 69–75 to 83–95 with 100/100/100 accessibility/best-practices/SEO. Two security holes (SSRF, stored XSS via share) and a silently dead AI fallback (retired model) were fixed. 0 → 200 tests; `astro check` 54 → 0 errors.

## 2. Major improvements by area

**Product / UX** — homepage is one promise + one input + working examples + "Recent on this device"; extracted recipes get stable local addresses (`/recipe?r=<id>`, up to 30 kept, migrated from the single legacy slot); Save/Share/Print/Copy on every recipe; Copy copies exactly what's shown (scaled, converted); Share falls back to a visible link when the clipboard is blocked; error states are specific ("We couldn't reach recipetineats.com", "instagram.com won't let us read that page…") with real actions; anonymous users are no longer gated after 3 structured extractions.

**Extraction** — new pipeline `src/lib/recipe/*`: JSON-LD (scored node selection, `@id` refs, loose JSON, `{@value}` titles) → microdata → DOM heuristics (with plausibility check) → Claude fallback (`claude-sonnet-5`, structured outputs). Entity decoding, section support (ingredient groups borrowed from WPRM/Tasty markup when JSON-LD is flat), instruction splitting/numbering cleanup, WPRM paren-note unwrapping, duration/yield normalization ("P0Y0M0DT0H15M", "PT150M" → "2 hr 30 min", "4 serving(s)", "Makes 16", "4 dozen"), image selection, half-empty structured data borrows the missing half from the page. Stream opens before rate-limit/cache/auth work (immediate progress instead of a blank 4–5s). URL normalization (tracking params, AMP, fragments, scheme-less, host:port). One structured log line per extraction.

**Design** — 16px base type, sand palette with a same-direction dark ramp (dark mode was illegible), one Tailwind compile inlined, self-hosted Geist, button system, print stylesheet (light, one/two-page card, two-column checklist), consistent icon/favicon/manifest, sentence-case labels.

**Mobile** — DOM order matches cooking (ingredients before steps), full-width Cook Mode CTA on phones, 16px inputs (no iOS zoom), 44px rows, safe-area padding, share target (`/?u=` from the installed app), progressive browse grids.

**Cook Mode** — one step at a time; swipe/keys/Home/End; step memory (24h) → "Resume step 7"; stepping ticks the Instructions list; ingredients sheet without losing your place; timers detected in step text; wake lock; long-step layout; Done debounced.

**Timers** — module store outlives Cook Mode and reloads (sessionStorage), audio primed on the Start tap (iOS), rings every 2s until dismissed, tab-title flash, full-screen alarm, floating bar on the recipe page.

**Scaling** — rewritten: mixed numbers, unicode/ascii fractions, ranges, dual units, conversions in parens, "N and a/b", "+ addends"; countables round to whole, tbsp→tsp / cup→tbsp for tiny amounts, unit + noun agreement (cups/cup, eggs/egg), later parentheticals scale ("(~2⅔ tbsp)") but container sizes never do; kg/l rounding. Swept 11,840 catalog line×factor combinations.

**SEO** — recipe pages render Recipe + BreadcrumbList JSON-LD (only real fields; source as `author`/`isBasedOn`), collections have CollectionPage/ItemList, 20 hand-introduced browse pages (each ≥ 8 recipes), www canonical everywhere, robots.txt fixed (`/recipe` prefix was blocking `/recipes/*`), sitemap excludes client-only shells, natural titles/descriptions, `llms.txt`.

**Performance** — hero PNG (1.18MB) removed; Google Fonts → self-hosted; two Tailwind bundles → one inlined; catalog images resized to WebP at build with `srcset` (collection pages 2.6MB → ~0.3–0.7MB); RecipeView island 36KB → 18.5KB gz; search-index thumbs 96px (was 1–2MB of originals per query); GA deferred to idle; browse grids reveal 24 at a time; long-cache headers.

**Accessibility** — 100 on every page tested; combobox search with `aria-activedescendant` + scroll-into-view; dialogs (Cook Mode, Remix, alarm) with focus management; live regions; skip link; contrast fixes (checkboxes, active rows, hearts over photos); visible focus rings; reduced-motion; whole-row 44px tap targets.

**Security** — SSRF-hardened fetch (DNS + CIDR incl. IPv6-mapped/NAT64/metadata, manual redirects ≤ 5, 12s timeout, 3MB cap, content-type check); share/remix validated with zod + size caps + rate limits + `javascript:` sourceUrl blocked (stored XSS); IP rate limits; anon quota token can't be reset by clearing a cookie (IP fallback); signed-in users actually recognised server-side (`sr_auth` cookie bridge — they were being metered as anonymous); collection slug guard; nesting-depth guard for hostile HTML.

**Engineering** — vitest suite (200), `typecheck`/`check` scripts, `astro check` clean, 12 dead files removed, duplicated parsers unified into `src/lib/recipe`, data normalizer script (idempotent), work log.

## 3. Bugs fixed (worst first)

SSRF (any internal address fetchable, redirects followed blindly) · Recipe JSON-LD never rendered (no `head` slot) · robots.txt & og-image 404 · Claude fallback silently 404ing since 2026-06-15 (retired model) · stored XSS via shared `sourceUrl` · signed-in users metered as anonymous; anon quota reset by clearing a cookie · scaling corrupted quantities ("1/2 cup"×2 → "2 /2 cup", "440 g" → "44 g") · durations shown raw ("P0Y0M0DT0H15M0.000S"), yields doubled ("4 serving(s) servings") · TTFB 4–5s before any progress · mobile order steps-before-ingredients · dark mode illegible · `/recipe` prefix in robots blocked `/recipes/*` · plan page recipe picker empty (dead glob) · favorites page shipped 678KB of props · opening an extracted favorite opened the *most recent* recipe instead · timers stopped when Cook Mode closed; silent on iOS · Header "More" couldn't close itself · curated hero photo lost in refactor (caught by critique) · extraction lost when localStorage full · malformed local entries white-screened `/recipe` and the paste box · sticky ingredients became a nested scroller · Sally's "2 and 3/4 cups" scaled wrong · metric conversion of ranges ("1 - 2 tbsp" → "1 - 30 ml") · privacy page described a product without accounts or a cache · Tailwind silently dropped every `/opacity` modifier on the token colours (tokens were bare `var(--x)`): translucent header/scrim/timer bar were fully transparent, search highlight invisible, dark-mode dividers fell back to gray-200 — tokens are now RGB triplets with `<alpha-value>` (found by the third QA pass) · timer bar caused a hydration mismatch on every recipe page while a timer ran.

## 4. Measurements (before → after)

| Lighthouse 13, mobile (Moto G / slow 4G / 4× CPU), single runs, ±5 | Before — production 2026-08-14 | After — local `astro build` served by a plain static server (no compression; production will be better) |
|---|---|---|
| Perf: home / recipe / collection | 69 / 75 / 71 (local build of the same code: 72 home) | 95 / 87–92 / 83–86 (new browse pages 76–92) |
| LCP: home / recipe / collection | 9.6 s / 5.6 s / 6.9 s | 2.7 s / 3.8 s / 4.4 s |
| Accessibility | 95–96 (color-contrast) | 100 on every page tested |
| Best practices | 100 (collections 77 — third-party cookie from a hotlinked image) | 100 |
| SEO | 100 — but 0 recipe pages carried Recipe schema, robots.txt/og-image 404 | 100, with 228 Recipe + BreadcrumbList blocks, CollectionPage/ItemList, sitemap cleaned |
| Page weight (uncompressed): home / recipe / collection | 1,493 KB / 591 KB / 1,275 KB (2,481 KB desktop) | 466 KB / 616 KB / 798 KB (GA's 168 KB is now the largest single item and loads at idle) |
| Render-blocking | Google Fonts CSS 853–933 ms + `_slug_.css` 257–311 ms on mobile | none first-party (CSS inlined, fonts self-hosted) |
| RecipeView island | 36 KB gz | 18.5 KB gz |
| Search result thumbnails | 1–2 MB of originals per query | 96 px WebP, ~3 KB each |
| Time to first SSE byte | after rate-limit/cache/auth (300–900 ms of KV/Supabase) | immediate |
| Tests | 0 | 200 (9 files) + 52 real-site JSON-LD fixtures |
| `astro check` errors | 54 | 0 |
| Indexable pages | 228 recipes + 16 collections (+ client-only shells) | + 20 browse pages; shells/auth excluded |

Not measured (don't have it): real-user metrics, production Lighthouse after deploy, extraction success rate on live traffic (the new log line makes that possible).

## 5. Files / architecture

- `src/lib/recipe/` — `types` (Recipe model with grouped ingredients/instructions), `jsonld`, `html` (microdata, heuristics, plugin sections), `extract` (waterfall + finalize), `ai` (Claude fallback), `normalize`, `units` (durations/yields, dependency-free), `scale`, `display`, `prepared` (lines as shown), `validate` (zod, size caps), `href`.
- `src/lib/` — `safeFetch` (SSRF), `url` (normalize/cache key), `limits` (IP rate limit), `storage`, `recentRecipes`, `cookState`, `timers` (detection), `timerStore` (running timers), `images` (build-time optimization + preflight), `browse` (page definitions).
- `src/components/recipe/` — `RecipeView` (one renderer for curated/extracted/shared), `Ingredients`, `Instructions`, `CookMode`, `Timers`, `ExtractedRecipePage`, `Icons`.
- `src/components/` — `SmartInput` (paste-or-search combobox + SSE client), `HeroInput`, `Header`, `RecentRecipes`, `RecipeCard`/`RecipeGrid` (progressive), `ErrorBoundary`.
- Pages: `index`, `recipes/[slug]`, `collection/[slug]`, `browse/[slug]`, `recipe` (local), `r/[id]` (shared, SSR), `search-index.json.ts` (built with thumbs), `privacy`, `404`; API: `extract-stream`, `share`, `remix`, `recipes/*`.
- `scripts/normalize-data.ts` (idempotent catalog cleanup), `public/manifest.webmanifest` + icons, `OVERNIGHT_AUDIT.md` (log).

## 6. Tests added

`tests/url` (normalization, cache keys, host:port), `safeFetch` (blocked ranges, redirects, limits), `normalize` (entities, durations, yields, ingredient/instruction cleanup, grouping), `extract` (waterfall, borrowing, plugin sections, hardening cases from fuzzing), `corpus` (52 real-site JSON-LD fixtures asserting title/ingredients/instructions/times/yield), `scale` (all production and QA cases), `timers`, `storage` (recent + cook state, malformed entries, quota), `browse` (page thresholds). Run: `npm test`, `npm run check`.

## 7. Ideas considered and rejected

Service worker / offline (staleness and cache-invalidation complexity for little value; manifest + local storage cover the real need) · runtime image proxy (abuse surface, cost; build-time only) · title-casing *extracted* titles (they belong to the publisher; only the catalog was normalized) · account gate on structured extraction (removed — it costs nothing) · AI rewriting/"cleaning" recipes on the structured path (fidelity) · programmatic tag-soup pages (20 hand-introduced pages instead) · hidden-link tricks for SEO · SEO schema fields we don't have (ratings, nutrition, dates) · sticky sidebar with inner scroll (looks complete when it isn't) · a residential proxy for Dotdash/AllRecipes (paid service, not configured).

## 8. Remaining opportunities

Astro 6/7 + adapter upgrade (advisories on 5.18.2 / vercel 9.0.5) · DNS pinning via undici dispatcher for `safeFetch` (small TOCTOU window remains) · Dotdash sites (AllRecipes, Serious Eats) block datacenter IPs — needs a residential fetch path · dedupe parser with `mcp-server/` and the extension · sync merge semantics (tombstones) for favorites/meal plan · Remix modal visual redesign to the new system · Recent thumbnails are remote originals · self-serve account deletion · per-recipe OG image · sitemap `lastmod` · voice/gesture step control in Cook Mode · favorites folders only when they earn it · production Lighthouse + extraction success rate after deploy.

## 9. Founder decisions needed

1. **Deploy.** Review and `git push` (Vercel deploys `main`). Nothing tonight touched infrastructure or secrets. Suggest deploying, then re-running Lighthouse on production.
2. **Canonical host** — I made `www.simpler.recipes` canonical because the apex 307s to it today. If you prefer apex, flip the Vercel domain redirect and `SITE_URL` in `BaseLayout.astro`.
3. **Quota policy** — structured extractions are free and unlimited (rate-limited per IP); AI fallback: 3 lifetime anonymous (cookie token + IP fallback), 30/month signed in. Constants in `src/utils/kv.ts` / `extract-stream.ts`.
4. **Privacy page** — rewritten to describe what actually happens (7-day cache, accounts, AI fallback, cookies, 1-year shared links, retention). It changes the "Last updated" date; please review before deploy.
5. **Favicon/app icon** changed from the 🍳 emoji to a list mark (matches manifest icons). Easy to revert (`public/favicon.svg`, `icon-*.png`).
6. **Catalog titles** — 47 BBC Good Food sentence-case titles were converted to Title Case for consistency (`scripts/normalize-data.ts`).
7. **Old Vite skeleton** — the untracked files on arrival were byte-identical to the initial commit; they're in `git stash@{0}`. Drop when convenient.
8. **Meal Plan / Pantry / Favorites** — kept, moved behind "More"; the product principle suggests they shouldn't grow further.
9. **Model cost** — AI fallback and Remix now use `claude-sonnet-5` (the previous model was retired and returning 404s).
