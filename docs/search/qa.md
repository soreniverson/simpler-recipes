# Search spike — QA record (2026-09-06)

## Commands run

| Check | Command | Result |
| --- | --- | --- |
| Unit + regression tests | `npm test` | 231/231 pass (12 files) — includes new registry-contract, time-bound, combo and healthy-tag tests in `tests/browse.test.ts` |
| Types | `npm run typecheck` | clean |
| Astro check | `npm run check` | 0 errors, 0 warnings (4 pre-existing hints) |
| Full static build | `SKIP_IMAGE_OPT=1 npm run build` | success; sitemap generated |
| Route crawl (built dist) | inline crawler → `docs/search/qa-crawl.txt` | 290 HTML pages; **0 broken internal links, 0 JSON-LD parse errors, 0 empty collections, 0 duplicate cards** |
| Surface report | `npm run search:report` | 35/37 collections live; manifest regenerated; 5 seasonal tasks in next 90 days |

## Crawl summary (full output: qa-crawl.txt)

- Families: 227 recipe pages, 36 browse (index + 35 collections), 16 curated collections, 4 new search pages, shells.
- noindex set is exactly the client shells: `/404`, `/favorites/`, `/pantry/`, `/plan/`, `/recipe/` (plus server-rendered `/shared` and `/r/*`, which never enter the static build).
- Sitemap: 285 URLs, 281 with genuine per-URL lastmod (recipe `addedDate` / registry dates); the 4 without a known content date carry none. `/shared`, `/recipe`, `/api`, `/auth`, `/r/*` all excluded. Canonicals are absolute production URLs on every checked page.
- JSON-LD spot checks: recipe page = Recipe+BreadcrumbList; browse = CollectionPage(ItemList)+BreadcrumbList; editorial = Article; tool/comparisons = WebPage. All parse; all `<`-escaped.

## Visual checks (dev server)

- `/recipe-cleaner/` and `/why-recipe-sites-have-long-stories/` screenshotted (desktop, dark theme): brand-consistent, paste box functional above the fold, no overflow.
- `/browse/grilling/` and `/alternatives/just-the-recipe/` verified by rendered text: 16 cards time-sorted, CleanBox present, comparison table renders with header row.
- Tables sit in `overflow-x-auto` wrappers; layout uses existing responsive components (RecipeGrid, SmartInput) already exercised on mobile.

## Extraction flow regression

- Core extraction verified earlier the same day on this codebase (structured fixture streams to `complete`; YouTube/error paths return typed errors). The spike touched SmartInput only additively (track calls); `npm test` covers extraction internals.

## External verification NOT performed (named follow-ups)

1. **Google Rich Results Test** on a recipe + collection URL after deploy — local parsing is not proof of Google eligibility.
2. **Search Console**: submit sitemap index, then watch impressions/clicks by page family (browse vs recipes vs pages) alongside GA4 events `clean_start → clean_success` and `recipe_card_open` per `surface`. Distinguish sessions from unique users in GA4; `clean_success` fires on the server's completion event, so it counts real outcomes, not attempts.
3. Indexing, rankings and conversion lift cannot be proven in this spike.
