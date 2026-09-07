import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildBrowsePages, BROWSE_PAGES, MIN_RECIPES } from '../src/lib/browse';

const data = JSON.parse(readFileSync(new URL('../recipe-data/all-recipes.json', import.meta.url), 'utf8'));
const pages = buildBrowsePages(data.recipes);

describe('browse pages', () => {
  it('builds only non-thin pages, all with intros', () => {
    expect(pages.length).toBeGreaterThan(10);
    for (const p of pages) {
      expect(p.recipes.length).toBeGreaterThanOrEqual(MIN_RECIPES);
      expect(p.intro.length).toBeGreaterThan(20);
      expect(new Set(p.recipes.map((r) => r.slug)).size).toBe(p.recipes.length);
    }
  });
  it('reports which definitions were dropped (informational)', () => {
    const dropped = BROWSE_PAGES.filter((b) => !pages.find((p) => p.slug === b.slug)).map((b) => b.slug);
    console.log('browse pages:', pages.map((p) => `${p.slug}=${p.recipes.length}`).join(', '), '| dropped:', dropped.join(', ') || 'none');
    expect(dropped.length).toBeLessThan(BROWSE_PAGES.length / 2);
  });
  it('vegetarian pages contain no meat', () => {
    const veg = pages.find((p) => p.slug === 'vegetarian')!;
    const meaty = /\b(chicken|beef|pork|bacon|salmon|tuna|shrimp|prawn)\b(?! or veg)/i;
    for (const r of veg.recipes) expect(r.ingredients.join(' ')).not.toMatch(meaty);
  });
  it('30-minute dinners are all ≤ 30 min', () => {
    const p = pages.find((x) => x.slug === '30-minute-dinners')!;
    for (const r of p.recipes) expect(String(r.totalTime)).not.toMatch(/hr|4[0-9] min|5[0-9] min|3[1-9] min/);
  });
  it('time-bounded pages never include recipes with missing total time', () => {
    for (const slug of ['30-minute-dinners', '20-minute-recipes', 'quick-vegetarian']) {
      const p = pages.find((x) => x.slug === slug)!;
      for (const r of p.recipes) expect(r.totalTime, `${slug} → ${r.slug}`).toBeTruthy();
    }
  });
  it('registry metadata is complete and unique (search-surface contract)', () => {
    const slugs = new Set<string>();
    const intents = new Set<string>();
    for (const p of BROWSE_PAGES) {
      expect(slugs.has(p.slug), `duplicate slug ${p.slug}`).toBe(false);
      slugs.add(p.slug);
      // One page per intent: near-duplicates must be consolidated, not multiplied.
      expect(intents.has(p.intent), `duplicate intent "${p.intent}"`).toBe(false);
      intents.add(p.intent);
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['ingredient', 'time', 'method', 'cuisine', 'dish', 'occasion', 'combo']).toContain(p.family);
      if (p.seasonal) {
        expect(p.seasonal.peakMonth).toBeGreaterThanOrEqual(1);
        expect(p.seasonal.peakMonth).toBeLessThanOrEqual(12);
        expect(p.seasonal.refreshBy).toMatch(/^\d{2}-\d{2}$/);
      }
    }
  });
  it('combo pages require both halves (chicken-and-rice has chicken AND rice)', () => {
    const p = pages.find((x) => x.slug === 'chicken-and-rice')!;
    for (const r of p.recipes) {
      const hay = `${r.title} ${r.ingredients.join(' ')}`;
      expect(hay, r.slug).toMatch(/chicken/i);
      expect(hay, r.slug).toMatch(/\brice\b/i);
    }
  });
  it('healthy-dinners only includes catalog-tagged healthy mains', () => {
    const p = pages.find((x) => x.slug === 'healthy-dinners')!;
    for (const r of p.recipes) expect(r.tags, r.slug).toContain('healthy');
  });
});
