# Recipe sources, licensing and provenance

Every imported recipe in `recipe-data/all-recipes.json` comes from a source that permits
commercial reuse. This file records why, so the claim is auditable rather than assumed.

## Why almost nothing else qualified

A site-by-site audit of ~70 recipe publishers found **no** mainstream publisher that permits
republishing full recipes with photos. Representative refusals, quoted from their own terms:

- **RecipeTin Eats** — "I never give permission to use my photos + ingredients + directions."
  "Commercial use of any of my content – words or images – without permission is prohibited."
- **People Inc.** (Allrecipes, Serious Eats, Simply Recipes) — "no part of the Services may be
  copied, reproduced, distributed, republished..."
- **Budget Bytes** — "commercial use will require the purchase of a license."
- **Immediate Media** (BBC Good Food), **Condé Nast**, **Hearst**, **NYT Cooking**, **Taste of
  Home**, **King Arthur** — equivalent prohibitions.
- All 16 Indian recipe sites checked, and all 18 grilling/BBQ sites checked: none permit it.
- All US university Extension / SNAP-Ed programmes checked: none permit **commercial** reuse.

Two traps worth recording, because both nearly caught this import:

1. **A `.gov` URL does not make a work federal.** Nutrition.gov republishes state-university
   Extension and industry-board material (e.g. "Courtesy of the National Pork Board"), which is
   copyrighted by those bodies and not covered by 17 USC §105. The importer therefore gates on
   each recipe's own machine-readable `creator` and rejects non-federal authors.
2. **The photo is the binding constraint, not the recipe text.** Ingredient lists are not
   copyrightable and directions are weakly protected, but photographs are — and several
   otherwise-open collections contain licensed stock (Adobe Stock, iStock) or exclude images
   from their open licence (the NHS excludes "visuals, image rights"). The importer rejects any
   image whose filename indicates stock, and every photo we ship is self-hosted, not hotlinked.

## Sources used

### NSW Government — 72 recipes — CC BY 4.0

> "All material on this website is licensed under the Creative Commons Attribution 4.0 licence,
> except as noted below." — https://www.nsw.gov.au/copyright

The exclusions are the State's Coat of Arms and logos, expressly-marked third-party material,
and NESA content. **Photographs are not excluded**, which is unusual — most public-sector
collections carve images out. Sampled recipes carry self-hosted images with no stock-agency
credits. CC BY 4.0 permits commercial use and imposes no share-alike obligation.

Required attribution, carried on every recipe page via its source link:
**© State of New South Wales. For current information go to www.nsw.gov.au**

*Residual risk:* the "any third party material" clause means an individual photo could in
principle be third-party. Nothing on the pages indicates this, but a written confirmation from
NSW Health would convert a strong inference into a warranty.

### Nutrition.gov (USDA) — 16 recipes — US federal works, public domain

> "Most information presented on the USDA Web site is considered public domain information.
> Public domain information may be freely distributed or copied, but use of appropriate
> byline/photo/image credits is requested." — https://www.usda.gov/policies-and-links

Public domain under 17 USC §105, which permits commercial use. Of the 16 imported:

- **9** name a specific federal agency (NIH/NHLBI, USDA ARS, Veterans Affairs,
  Team Nutrition, WIC Works, FNS, SNAP-Ed Connection). Provenance is unambiguous.
- **7** are attributed to "USDA MyPlate" or similar. USDA published these under its
  own name, but MyPlate also hosted partner-contributed recipes, so for these the federal
  authorship is USDA's assertion rather than something we independently verified. They are
  listed below so the call can be revisited.

## Per-recipe provenance (Nutrition.gov)

| Recipe | Stated creator | Source |
|---|---|---|
| Avocado Deviled Eggs | US Department of Veterans Affairs Nutrition | [source](https://www.nutrition.gov/recipes/avocado-deviled-eggs) |
| Avocado Melon Breakfast Smoothie | USDA MyPlate | [source](https://www.nutrition.gov/recipes/avocado-melon-breakfast-smoothie) |
| Avocado and Corn Salsa | USDA MyPlate | [source](https://www.nutrition.gov/recipes/avocado-and-corn-salsa) |
| Baked Tofu Bites | Team Nutrition CACFP Easy Recipe Project | [source](https://www.nutrition.gov/recipes/baked-tofu-bites) |
| Black Bean Quesadilla | USDA: MyPlate | [source](https://www.nutrition.gov/recipes/black-bean-quesadilla) |
| Blueberry Oatmeal Pancakes | U.S. Department of Veterans Affairs | [source](https://www.nutrition.gov/recipes/blueberry-oatmeal-pancakes) |
| Broccoli-Cheddar Frittata | MyPlate Recipes | [source](https://www.nutrition.gov/recipes/broccoli-cheddar-frittata) |
| Cabbage Comfort | USDA MyPlate | [source](https://www.nutrition.gov/recipes/cabbage-comfort) |
| Couscous With Carrots, Walnuts, and Raisins | NIH National Heart, Lung, and Blood Institute | [source](https://www.nutrition.gov/recipes/couscous-carrots-walnuts-and-raisins) |
| Cowboy Caviar | USDA: MyPlate | [source](https://www.nutrition.gov/recipes/cowboy-caviar) |
| Cranberry Apple Farro Stuffing | USDA, Agricultural Research Service. | [source](https://www.nutrition.gov/recipes/cranberry-apple-farro-stuffing) |
| Curried Chicken Wraps | Team Nutrition CACFP Easy Recipe Project | [source](https://www.nutrition.gov/recipes/curried-chicken-wraps) |
| Easy-As-A-Mix Pizza | MyPlate Recipes | [source](https://www.nutrition.gov/recipes/easy-mix-pizza) |
| Moroccan Spiced Turkey Burger | USDA, Agricultural Research Service. | [source](https://www.nutrition.gov/recipes/moroccan-spiced-turkey-burger) |
| Red Lentil Latkes | SNAP-Ed Connection | [source](https://www.nutrition.gov/recipes/red-lentil-latkes) |
| Roasted Pumpkin Seeds | USDA WIC Works | [source](https://www.nutrition.gov/recipes/roasted-pumpkin-seeds) |

## Sources deliberately rejected

| Source | Reason |
|---|---|
| TheMealDB | Permissive-sounding terms, but 0 of 790 sampled meals carried the CC confirmation its own docs say to check; 753 link to copyrighted blogs. |
| myplate.food | Third-party mirror. Its own terms reserve commercial reuse of its edition and AI-remastered images for a paid licence; it is not a rights authority for USDA content. |
| based.cooking | Declares everything public domain, but a sampled image carried embedded XMP metadata reading "2018 Marco Morala. All rights reserved." A contributor cannot dedicate what they never owned. |
| Fandom Recipes Wiki | CC BY-SA footer over documented bulk imports from a Yahoo Group; fair-use images permitted by policy. |
| Foodista | CC BY 4.0 terms, but user uploads visibly relicense other people's recipes and photos. |
| Cookipedia | ~36% of its image pool is non-commercial, copyrighted-by-permission, or unlicensed. |
| Mealie / Tandoor fixtures | Repo licences cover code; the recipe fixtures are verbatim third-party content (Bon Appétit, A Spicy Perspective). |
| Wikibooks Cookbook | CC BY-SA is usable, but share-alike would attach to our recipe pages and images need per-file attribution. Kept as a future option, not used here. |
