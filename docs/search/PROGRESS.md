# Search spike — progress log

Branch: claude/search-spike. Brief: one-day organic-search implementation.

## Status — COMPLETE (2026-09-06)
- [x] H1 Audit → audit.md (catalog: 227 recipes, coverage counts, publication rules verified)
- [x] H2-3 Publishing model + technical SEO (registry metadata; sitemap: real per-URL lastmod, /shared excluded)
- [x] H4-5 Collections: 15 new launched (35 live), 2 gated-awaiting-coverage, 11 drafts with reasons → launch-manifest.json
- [x] H6 Editorial (/why-recipe-sites-have-long-stories/) + tool (/recipe-cleaner/) + 2 sourced comparisons
- [x] H7 Seasonal (5 pages with windows, calendar CSV, `npm run search:report`) + GA4 funnel events
- [x] H8 Verification (231 tests, typecheck, astro check, build, 290-page crawl: 0 broken links / 0 schema errors) → qa.md, handoff.md

## Decisions (full rationale in audit.md)
- Extended existing browse registry; one source of truth for routes/sitemap/calendar/manifest.
- MIN_RECIPES=8 kept; gate computed at build (pork/eggs auto-launch when coverage arrives).
- 15-minute intent consolidated into 20-minute page; no "X without ads" duplicate pages.
- No prices printed that primary sources don't state; unknown = "not listed".
- Thanksgiving: honest zero-coverage gap, no page forced.

## Remaining release actions (user)
1. Merge PR; Vercel auto-deploys.
2. Post-deploy: Rich Results Test one recipe URL; submit sitemap-index.xml in Search Console.
