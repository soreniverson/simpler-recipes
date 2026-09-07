# Search surface — handoff

## Add a collection page

1. Add an entry to `BROWSE_PAGES` in `src/lib/browse.ts`: slug, name, 1–2 sentence intro, `intent` (the search phrase — one page per intent), `family`, `published` (today), a **pure** `match` function based on real catalog evidence (tags/themes/ingredients — not title guesses for methods/diets), and optional `seasonal`.
2. The `MIN_RECIPES = 8` gate applies at build: thin pages simply don't ship (and auto-launch later if catalog coverage grows — `pork` and `eggs` are waiting this way).
3. Run `npm test` (registry-contract tests enforce unique slugs/intents, date formats) and `npm run search:report` (regenerates `launch-manifest.json`).
4. If the candidate doesn't clear the gate, add it to `DRAFTS` in `scripts/search-report.ts` with the honest reason instead.

Do **not**: create a second page for a keyword variant of an existing intent (consolidate), promise diets/allergens without ingredient-level evidence, or use cook time as total time (time pages use `totalTime` only, and missing time excludes the recipe).

## Refresh comparison facts

`/alternatives/just-the-recipe/` and `/compare/simpler-vs-paprika/` show a "checked <date>" line. To refresh: re-verify each row against the competitor's own pages, update the row + the `CHECKED` const, log it in `docs/search/sources.md`, and bump `updated` for that path in `src/lib/searchPages.ts` (that feeds the sitemap lastmod). Unknowns stay "not listed", never "No".

## Seasonal workflow

- `docs/search/seasonal-calendar.csv` is the rolling calendar (US audience). `npm run search:report` prints tasks due in the next 90 days; it never publishes anything.
- Seasonal pages are ordinary registry entries with `seasonal` metadata and yearless URLs — refresh intros/promotion at `refreshBy`, don't clone pages per year.
- Current gaps the calendar tracks: Thanksgiving (0 recipes — add coverage or skip), holiday-cookies (6 < gate), Super Bowl exact date unverified.

## Measurement

- GA4 events (see `src/lib/track.js`): `clean_start`, `clean_success{method,cached}`, `clean_error{code}`, `recipe_card_open{slug}`, all with `surface` = route pathname. Never add raw URLs or user text to events.
- Funnel to watch per landing family: pageview → `recipe_card_open` (browse) or `clean_start → clean_success` (tool/editorial). Search Console: submit `sitemap-index.xml`, compare impressions/clicks by URL prefix (`/browse/`, `/recipes/`, the four pages).

## Validate / release / roll back

- Validate: `npm test && npm run typecheck && npm run check`, then `SKIP_IMAGE_OPT=1 npm run build` and eyeball `dist/client/sitemap-0.xml`.
- Release: normal PR → merge to `main` → Vercel auto-deploy (same as every other change). Post-deploy: run the Rich Results Test on one recipe URL; submit the sitemap in Search Console once.
- Roll back: revert the merge commit; pages are static so there's no data migration in either direction.
