# Sources for factual & competitor claims

All accessed 2026-09-06. Re-check comparison facts before materially editing those pages, and bump `updated` in `src/lib/searchPages.ts` when you do.

## Editorial (/why-recipe-sites-have-long-stories/)

| Claim | Source |
| --- | --- |
| A bare ingredient list isn't copyrightable; protection may attach to "substantial literary expression" around a recipe | US Copyright Office FAQ — https://www.copyright.gov/help/faq/faq-protect.html |
| Food-blog ad revenue is impression-based (RPM); longer pages hold more ad slots | Bootstrapped Ventures (food-blog tooling vendor) — https://bootstrapped.ventures/why-do-recipe-blogs-have-stories/ |
| SEO belief/practice of long-form recipe posts | Same as above; framed in-page as belief/incentive, not as a Google requirement (Google states no minimum word count; we make no contrary claim) |

## /alternatives/just-the-recipe/

| Claim | Source |
| --- | --- |
| Free tier: declutter any site, save up to 20 recipes, cross-device with account | https://help.justtherecipe.com/article/33-is-jtr-free |
| Premium: unlimited saves, print, adjust servings, priority support; monthly/6-month/yearly billing | https://help.justtherecipe.com/article/4-what-is-premium |
| Platforms: iOS, Android, web | App Store / Google Play listings (ids: apple 1598423213; google com.streamline.justtherecipe) |
| Premium price | **Not printed on the page** — their help center doesn't list an amount; page links to their site instead |

## /compare/simpler-vs-paprika/

| Claim | Source |
| --- | --- |
| Platforms iOS/Android/Mac/Windows; "each version of Paprika is sold separately" | https://www.paprikaapp.com/ |
| Built-in browser recipe download; aisle-sorted grocery list that combines items; meal plans (week/month, reusable menus); pantry; Cloud Sync; scaling/conversion/cross-off/step highlight/timer detection | https://www.paprikaapp.com/ (feature copy) |
| Free desktop demo limited to 50 recipes | Secondary (eathealthy365.com pricing roundup); phrased on-page without exact prices |
| Exact prices | **Not printed on the page** — secondary sources say ~$4.99 mobile / ~$29.99 desktop but paprikaapp.com doesn't list amounts; page points to their site/app stores |

## Simpler claims used on these pages (verified in this repo)

- Free; no account needed to clean a recipe; account adds sync + larger AI allowance (3 anonymous / 30 per month authenticated — `src/utils/kv.ts`).
- AI fallback only when a page lacks structured data (`src/pages/api/extract-stream.ts`); quantities verbatim (`src/lib/recipe/ai.ts` prompt); source credit on every recipe (RecipeView + schema `isBasedOn`).
- Scaling, check-off, Cook Mode, timers, print CSS, favorites/folders, meal plan, pantry: `src/components/recipe/*`, `src/pages/plan.astro`, `src/pages/pantry.astro`.
- No grocery list, no native apps, no offline guarantee, no import tools — stated as limitations.
