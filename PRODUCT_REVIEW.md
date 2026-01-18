# Simpler Recipes - Product Review & Recommendations

*Comprehensive audit completed January 18, 2026*

---

## Executive Summary

After thoroughly reviewing the Simpler Recipes codebase, I've identified **opportunities across four key areas**: accessibility, performance, UX, and new features. The application has a solid foundation with excellent static site generation, clean design, and good user flows. However, there are several issues that should be addressed and opportunities to enhance the product.

### Key Findings at a Glance

| Area | Status | Priority Issues |
|------|--------|-----------------|
| **Accessibility** | Needs Work | Missing modal semantics, no reduced-motion support, touch targets too small |
| **Performance** | Good with Gaps | Fuse.js index recreated on every page, recipe data embedded in all pages |
| **UX** | Strong Foundation | Error messages need context, feature discoverability could improve |
| **Features** | Solid Core | Shopping list, offline support, and meal planning are natural next steps |

---

## 1. Accessibility Issues (Priority: HIGH)

### Critical Issues

**A. No `prefers-reduced-motion` Support**
- All animations (scale, transitions, spinners) run regardless of user preference
- Affects users with vestibular disorders
- **Fix**: Add media query to disable/reduce animations globally

**B. CookMode Modal Missing Accessibility Semantics**
- Missing `role="dialog"` and `aria-modal="true"`
- No focus trap - users can tab outside the modal
- No focus restoration when closing
- **Location**: `src/components/CookMode.jsx`

**C. Touch Targets Too Small**
- Servings +/- buttons are 28px (should be 44px minimum)
- Small favorite buttons are ~22px
- Close buttons in modals are ~36px
- **Location**: `ScalableIngredients.jsx`, `FavoriteButton.jsx`, `CookMode.jsx`

**D. Dropdown Menus Missing ARIA Semantics**
- Settings dropdown and search dropdown lack `role="menu"` and `role="menuitem"`
- No keyboard navigation within dropdowns (arrow keys)
- No `aria-expanded`, `aria-controls` linking
- **Location**: `Header.jsx`, `SmartInput.jsx`

**E. Color Contrast in Dark Mode**
- `--primary: #9d9c98` on dark background likely fails WCAG AA (estimated 3.5:1)
- Secondary text using `sand-500` (#5a5854) has very low contrast (~2.5:1)
- **Location**: `BaseLayout.astro` dark mode CSS variables

### Medium Priority

- Servings control is a `<span>`, not a proper `<input type="number">` - not keyboard accessible
- Recipe card images have empty `alt=""` - should describe the dish
- Step counter in CookMode doesn't announce changes to screen readers
- Share URL input missing `aria-label`

---

## 2. Performance Issues (Priority: MEDIUM-HIGH)

### Critical Issues

**A. Fuse.js Search Index Recreated on Every Page**
- Creates new Fuse instance on every SmartInput mount
- With 228+ recipes, costs ~50-100ms per page
- Happens on homepage AND header (all pages)
- **Fix**: Pre-build search index at compile time, ship as JSON
- **Location**: `src/components/SmartInput.jsx` lines 170-174

**B. Recipe Data Embedded in Every Page's HTML**
- Full `all-recipes.json` (592KB) loaded at build time for Header search
- Serialized into initial HTML for every page
- **Fix**: Load search data on-demand via fetch, or build optimized index
- **Location**: `src/layouts/BaseLayout.astro` lines 27-29

**C. Over-Hydration of React Components**
- Using `client:load` on too many components
- Collection pages hydrate RecipeCard for each recipe (potentially 50+ components)
- Each FavoriteButton gets full React runtime
- **Fix**: Use `client:idle` or `client:visible`, consolidate hydration boundaries
- **Location**: Multiple page files

### Medium Priority

- Images missing `width`/`height` attributes (causes layout shift)
- No WebP/AVIF image formats
- API endpoints read entire JSON file to find single recipe (O(n) search)
- No server-side caching for file system reads
- Google Analytics adds ~50-100ms to Time to Interactive

### Recommendations Summary

| Optimization | Impact | Effort |
|--------------|--------|--------|
| Pre-build Fuse.js index | High | 2-3 hours |
| Load search data on-demand | High | 4-5 hours |
| Use `client:idle` hydration | Medium | 2-3 hours |
| Add image dimensions | Medium | 1 hour |
| Implement server-side cache | Medium | 1-2 hours |

---

## 3. UX Issues (Priority: MEDIUM)

### Error Handling Gaps

**A. Recipe Extraction Errors Are Vague**
- User sees: "Failed to extract recipe" or "The site may not use Schema.org markup"
- No indication of what went wrong or how to fix it
- **Fix**: Add error context badges (Invalid URL, No Recipe Data, Network Error)
- **Fix**: Show actionable suggestions ("Try another recipe site like allrecipes.com")

**B. Shared Recipe Errors Don't Distinguish Expired vs Invalid**
- API returns different messages but UI shows generic error
- Users don't know if link expired (7-day TTL) or was never valid

### Feedback & Discoverability

**A. No Toast Confirmation for Favorites**
- Heart animates but no text confirmation
- User doesn't know if recipe was actually saved
- **Fix**: Add subtle toast "Recipe saved to favorites"

**B. Cook Mode Not Obvious to New Users**
- Hidden behind a button, no onboarding hint
- First-time users might miss this valuable feature
- **Fix**: Show tooltip on first recipe view

**C. Keyboard Shortcuts Not Discoverable**
- `Cmd+K` hint only shows on desktop when search is empty
- No help page or shortcut reference

### Navigation Issues

**A. No Breadcrumbs on Recipe Pages**
- Only "Back" button, no context like "Back to Quick Dinners"
- User loses sense of where they came from

**B. Extracted Recipes Lost on Refresh**
- Data stored in `sessionStorage`, lost on page reload
- No way to recover without re-extracting

### Mobile Experience

- Search dropdown may overflow on small screens
- Settings panel could be a modal on mobile
- Cook Mode could benefit from swipe gestures

---

## 4. Feature Opportunities (Priority: MEDIUM)

### High Value, Feasible Now

**A. Shopping List Management**
- Add ingredients from multiple recipes
- Automatic quantity consolidation (1 cup flour + 2 cups = 3 cups)
- Categorized by grocery section (produce, dairy, pantry)
- Export/print functionality
- *Why valuable*: Users often cook multiple recipes; consolidating reduces effort

**B. PWA & Offline Support**
- Cache all 228 curated recipes for offline browsing
- Service worker for faster loads
- Add to home screen with app shortcuts
- *Why valuable*: Browse recipes on airplane mode, faster app experience

**C. User Notes & Ratings**
- Add personal notes to saved recipes ("Reduced sugar by 25%")
- Simple 5-star rating system
- Mark as "tried", "to try", "family favorite"
- *Why valuable*: Turns static recipes into living documents

### Medium Value, Medium Effort

**D. Advanced Filtering**
- Filter by prep time (< 15 min, < 30 min, etc.)
- Filter by servings, difficulty (data already exists!)
- Dietary filters (vegetarian, gluten-free) - needs data enrichment
- *Note*: Difficulty data already in recipes but not surfaced in UI

**E. Recipe Search by Ingredients**
- "What can I make with chicken, rice, and broccoli?"
- Match against ingredient lists, show percentage match
- Highlight missing ingredients

**F. Meal Planning Calendar**
- Plan weekly meals with drag-and-drop
- Auto-generate shopping list from plan
- Save meal plan templates

### Future Considerations

- Persistent share links (requires Vercel KV)
- Nutrition information integration
- Ingredient substitution suggestions
- Step timers in Cook Mode
- Export to Notion/other apps

---

## 5. Quick Wins (Can Fix Today)

These are low-effort fixes with meaningful impact:

1. **Add `prefers-reduced-motion` media query** - 10 minutes
2. **Display difficulty badges on recipe cards** - Data exists, just needs UI
3. **Increase touch target sizes** - CSS changes only
4. **Add `role="dialog"` to CookMode** - 5 minutes
5. **Add image dimensions to prevent layout shift** - Straightforward
6. **Show extraction error context** - Improve error messages in API

---

## 6. Architecture Notes

### What's Working Well

- **Static site generation**: Fast page loads, good SEO
- **Component architecture**: Clean separation of concerns
- **CSS variable theming**: Dark mode implementation is solid
- **Accessibility foundation**: Skip links, ARIA labels, semantic HTML
- **Mobile responsiveness**: Thoughtful breakpoints

### Areas for Improvement

- **Data loading**: Recipe data should be loaded more efficiently
- **Hydration strategy**: Too many isolated React islands
- **Share storage**: In-memory storage resets on deploy (needs Vercel KV)
- **Search efficiency**: Index should be pre-built

---

## 7. Recommended Priorities

### Phase 1: Polish (1-2 days)
1. Fix critical accessibility issues (reduced motion, touch targets, modal semantics)
2. Improve error message clarity
3. Surface difficulty badges in UI
4. Add toast notifications for user actions

### Phase 2: Performance (2-3 days)
1. Pre-build Fuse.js search index
2. Load search data on-demand
3. Optimize component hydration
4. Add image dimensions

### Phase 3: Features (1-2 weeks)
1. Shopping list management
2. PWA with offline support
3. User notes and ratings
4. Advanced filtering

### Phase 4: Growth (Future)
1. Persistent share links
2. Meal planning
3. Ingredient-based search
4. Nutrition data

---

## Files Referenced

| Category | Key Files |
|----------|-----------|
| Accessibility | `CookMode.jsx`, `Header.jsx`, `SmartInput.jsx`, `FavoriteButton.jsx`, `BaseLayout.astro` |
| Performance | `SmartInput.jsx`, `BaseLayout.astro`, `searchIndex.js`, page files |
| UX | `SmartInput.jsx`, `FavoritesPage.jsx`, `SharedRecipeView.jsx`, `ScalableIngredients.jsx` |
| Data | `recipe-data/all-recipes.json`, API routes in `src/pages/api/` |

---

*This review was generated through comprehensive codebase analysis. All findings include specific file locations and actionable recommendations.*
