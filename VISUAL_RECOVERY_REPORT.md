# Visual Recovery Report — 2026-08-15

Correcting the visual regression introduced by the overnight autonomous run, while keeping its
engineering work. Method: run the pre-agent commit (`7c25b0c`) and current `main` side by side on
two local servers, capture identical viewports, measure computed styles rather than trust memory,
then change only what the comparison proved worse.

Three versions are referenced throughout:

| name | what it is |
|---|---|
| **baseline** | `7c25b0c` — the product before the overnight run |
| **current** | `5ac5603` — what the overnight run shipped (now deployed) |
| **candidate** | this pass — the recovery |

---

## 1. Root causes of the degradation

Measured, not guessed.

1. **Image demotion — the single worst regression.** The recipe hero went from **668×334 in the
   content column** to **340×213 in the right sidebar**. The dish stopped being the subject of the
   recipe page and became a reference chip. On the homepage, the 2×2 food collage was **deleted
   outright** (it was a 1.18MB PNG) leaving a homepage with *zero* imagery. Both were done for
   Lighthouse. That is the "we removed the beautiful thing and the score improved" failure.

2. **Visual feature creep.** Five labelled actions (Cook Mode / Save / Share / Print / Copy) were
   promoted into a toolbar directly under the recipe title — the highest-value real estate on the
   page — because the capabilities existed.

3. **Over-componentisation flattening content into UI.** Every ingredient row got a checkbox *and*
   a full-strength divider. Thirty ingredients became a thirty-row todo list. Section headings grew
   count badges ("INGREDIENTS 30", "INSTRUCTIONS 16") that read like debug output.

4. **Heading hierarchy traded for uniformity.** Titles went from **33.75px / weight 500 /
   -0.675px tracking** to **32px / weight 600 / -0.48px** — smaller *and* heavier. Consistent, and
   less refined. (Body text was *not* uniformly shrunk: instruction text actually improved,
   15.75px → 17px. So the fix was hierarchy, not a global scale revert — see §3.)

5. **SEO surface placed on the primary screen.** A 20-link "by ingredient, time and occasion" block
   sat on the homepage under the collections, turning the first screen into a link directory.

6. **Density chased in the wrong direction on browse.** The collection grid went 3-col/335px images
   → 4-col/243px images. More items, less appetite — and ragged two-line titles broke row rhythm.

7. **A11y contrast applied bluntly.** Card favourite hearts became opaque black pills; ingredient
   checkbox borders were darkened. Both read louder than the content they sat on.

---

## 2. Reverted to the pre-agent design

- **Recipe hero photo** back in the content column at the baseline's exact **2:1** proportion on
  desktop (16:9 on phones so the fold still reaches content). The page is one grid now, so mobile
  keeps the cooking-correct order (image → title → ingredients → steps).
- **Homepage food collage** restored — same asset, re-encoded: **1,185KB PNG → 38KB WebP** (1×) /
  101KB (2×), still desktop-only as it always was. The design came back; the payload did not.
- **Editorial heading treatment** — medium weight, larger, tighter tracking, on recipe, collection,
  browse and home.
- **Collection grid** back to **3 columns with large images**; card image sources raised to
  360/520/700w so the bigger tiles are actually sharp.
- **Ingredient leading** restored (23.2px → ~26px line-height).
- **Favourite mark** is no longer a black pill.

## 3. Kept from the overnight run

Deliberately **not** reverted, because the comparison showed them better or they are engineering:

- **Root font-size stays 16px.** The baseline's 18px is *not* what made it feel better — measured
  body text is larger now (instructions 17px vs 15.75px). The character difference was heading
  weight and image scale, which are fixed directly. Reverting the root would now desync every
  px-specified component.
- Instruction reading size/measure, ingredients-before-steps on mobile, breadcrumbs, the
  paste-first header search, error copy.
- All engineering: extraction pipeline, SSRF/XSS hardening, schema/robots/sitemap, 200 tests,
  timers, scaling, data normalisation, build-time image pipeline, token→RGB fix, print stylesheet.

## 4. Reworked (function kept, visual treatment redone)

| feature | before | now |
|---|---|---|
| Recipe actions | 5-button toolbar under the title | Cook Mode is the one prominent control; Save is an icon; Share/Print/Copy live in a quiet "⋯" menu |
| Ingredient check-off | checkbox + full divider per row | 16px quiet mark, hairline (`sand-200/45`) so two-line entries still separate, text is the object |
| Section headings | "INGREDIENTS 30" | "Ingredients" — the count appears only once you start ticking (`3/30`) |
| Cook Mode | step counter **and** progress bar; oversized primary timer button | counter only; timer button back to secondary |
| Homepage collections | 4-col bare text list, then cards | typographic index, name + count on hairline rules |

## 5. Removed / demoted visible UI

- The **20-link browse block** left the homepage for a new **`/browse/`** index (still one click
  away, still crawlable, no longer competing with the paste box).
- **Count badges** on section headings at rest.
- The **Cook Mode progress bar**.
- Dot separators in the homepage examples row (they dangled at line ends when wrapping).
- The **hero card container** — see the honest note in §7.

## 6. Screenshot matrix

`docs/visual-recovery/{baseline,current,candidate}/` — home, recipe and collection at desktop
(1280×900) and mobile (390×844).

| screen | what changed, candidate vs current |
|---|---|
| **home-desktop** | Food returns to a homepage that had none, beside (not above) the input. The 20-link directory block is gone; the collection index stays as a typographic list rather than becoming cards. |
| **home-mobile** | Unchanged in structure — still the whole product in one screenful — minus the dangling separators. Roughly ten collections remain reachable above the fold. |
| **recipe-desktop** | The dish leads the content column at 2:1 instead of sitting as a 340px sidebar chip; the five-button toolbar collapses to one CTA plus two quiet icons; ingredients read as a list, not a form. |
| **recipe-mobile** | Full-bleed photo into a larger, lighter title; single correctly-sized Cook Mode button (the previous one overflowed 390px); ingredients and the servings stepper still land above the fold. |
| **collection-desktop** | 3 columns with large photography instead of 4 small ones; captions unchanged; favourite mark legible without being a badge. |
| **collection-mobile** | Same 2-up grid, favourite mark now visible over pale photography. |

## 7. Verification and honest notes

Two **blind** design critics (desktop and mobile) compared all three versions with labels
randomised per screen, so neither could tell old from new. Results:

- **Recipe, mobile: the candidate won.** "The full-bleed photo fading into the title is the single
  most premium moment in the whole set." Both the baseline and current ranked below it.
- **Collection, desktop: the candidate won** — "images are the grid; no chrome, one meta field,
  honest editorial browse."
- **Homepage: both critics ranked the *overnight* version first**, above both the baseline and my
  first candidate. Their objection to my candidate was the restored hero **card**: "a card floating
  on a near-identical background", "the hero card is decoration… costs a category or two". I
  removed it. That is a place where the brief said restore the old, and the evidence said the old
  container was the generic part — the imagery was the part worth recovering, and it is back. The
  brief's own principle ("striking through reduction, not decoration"; "delete containers where
  whitespace alone works") points the same way.
- **Recipe, desktop: the desktop critic preferred title-first** with the photo demoted — i.e. it
  preferred the regression. I did not follow it: that is a different product philosophy, not
  evidence of a regression, and the brief is explicit that the recipe page should read as editorial
  information design. I did act on its concrete defect: removing *every* divider made two-line
  ingredients blur, so a hairline came back.
- Both critics independently flagged the favourite heart as illegible over pale photography in
  *every* version. Fixed with a soft radial scrim that keeps the 44px tap target.

**Remaining concerns**

1. `docs/visual-recovery/` adds ~2.2MB of JPEGs to the repo. Delete once reviewed.
2. Favourites / Meal Plan / Pantry / Remix still use the older card and modal styling; they are
   demoted behind "More" but were not restyled in this pass.
3. Dark mode was checked on home, recipe and collection but not exhaustively on secondary pages.
4. Lighthouse was deliberately not re-chased. The homepage now loads a 38KB image it did not load
   this morning, and recipe/collection images are larger by design; expect a small score cost that
   is the intended trade.
5. The headless capture tool clips ~10px on the right at 390px — verified as a capture artifact
   (`document.scrollWidth === innerWidth`), not a layout overflow.

**State:** 200 tests pass, `astro check` clean, production build succeeds. Committed on `main`,
**not deployed** — the deploy from earlier today is the "current" column above.
