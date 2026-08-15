/**
 * Regression corpus: JSON-LD blocks captured from ~55 real recipe sites (Aug 2026).
 * Every fixture is fed through the same path the API uses. We assert quality INVARIANTS
 * (not exact output) so parser improvements don't require touching 55 expectations,
 * while regressions in any class (entities, tags, durations, yields, empties) fail loudly.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractRecipeFromHtml } from '../src/lib/recipe/extract';

const dir = join(__dirname, 'fixtures', 'jsonld');
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

// Pages that are known-not-recipes (kept as negative controls).
const NEGATIVE = new Set(['bbcgoodfood.com__collection-page.json']);
// Pages whose structured data legitimately lacks instructions on the page (needs DOM/AI).
const KNOWN_PARTIAL = new Set(['thepioneerwoman.com.json']);

function toHtml(blocks: unknown[]): string {
  return `<!doctype html><html><head><title>t</title>${blocks
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`)
    .join('')}</head><body></body></html>`;
}

const HTML_TAG = /<\/?[a-z][^>]*>/i;
const ENTITY = /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i;
const RAW_ISO = /^P(T|\d)/;

describe('real-site JSON-LD corpus', () => {
  for (const file of files) {
    const fx = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { url: string; jsonld: unknown[] };
    const html = toHtml(fx.jsonld);
    it(file, () => {
      const out = extractRecipeFromHtml(html, fx.url);
      if (NEGATIVE.has(file)) {
        // May extract a stub; must not have a healthy-looking recipe.
        if (out.recipe) expect(out.recipe.instructions.length).toBe(0);
        return;
      }
      expect(out.recipe, 'recipe found').toBeTruthy();
      const r = out.recipe!;
      expect(r.title.length, 'title').toBeGreaterThan(2);
      expect(r.title).not.toMatch(/untitled/i);
      expect(r.ingredients.length, 'ingredients').toBeGreaterThan(1);
      if (!KNOWN_PARTIAL.has(file)) expect(r.instructions.length, 'instructions').toBeGreaterThan(0);
      for (const s of [r.title, ...r.ingredients, ...r.instructions]) {
        expect(s, 'no html tags').not.toMatch(HTML_TAG);
        expect(s, 'no entities').not.toMatch(ENTITY);
        expect(s, 'no nbsp').not.toMatch(/ /);
        expect(s, 'no double spaces').not.toMatch(/ {2}/);
        expect(s.trim(), 'trimmed').toBe(s);
      }
      for (const ing of r.ingredients) {
        expect(ing, 'no price annotations').not.toMatch(/\(\s*\$\d/);
        expect(ing, 'no double parens').not.toMatch(/\(\(|\)\)/);
        expect(ing, 'no "( ,"').not.toMatch(/\(\s*,/);
      }
      for (const step of r.instructions) {
        expect(step, 'no leading numbering').not.toMatch(/^(step\s*)?\d{1,2}[.)]\s/i);
        expect(step.length, 'no mega-blob').toBeLessThan(1200);
      }
      for (const t of [r.prepTime, r.cookTime, r.totalTime]) {
        if (t) expect(t, 'human duration').not.toMatch(RAW_ISO);
        if (t) expect(t, 'no "150 min"').not.toMatch(/^\d{3,} min$/);
      }
      if (r.servings) {
        expect(r.servings, 'no serving(s)').not.toMatch(/serving\(s\)/i);
        expect(r.servings, 'no double servings').not.toMatch(/servings\s+servings/i);
        expect(r.servings.trim()).toBe(r.servings);
      }
      if (r.image) expect(r.image).toMatch(/^https?:\/\//);
      expect(r.sourceUrl).toBe(fx.url);
    });
  }
});
