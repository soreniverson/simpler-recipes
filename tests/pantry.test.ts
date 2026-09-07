import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkPantry, foodOf } from '../src/lib/recipe/pantry';
import { buildBrowsePages, MIN_RECIPES } from '../src/lib/browse';

const data = JSON.parse(readFileSync(new URL('../recipe-data/all-recipes.json', import.meta.url), 'utf8'));

describe('pantry rule', () => {
  it('accepts a recipe built only from shelf-stable and long-keeping ingredients', () => {
    const v = checkPantry(['1 can (400g) chopped tomatoes', '1 onion, diced', '2 cloves garlic', '1 cup dried pasta', '2 tbsp olive oil', 'salt and pepper']);
    expect(v.offenders).toEqual([]);
    expect(v.unknown).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('rejects anything needing a shop — fresh protein, fresh herbs, salad, cream', () => {
    for (const bad of ['500g chicken breast', '1 cup fresh coriander, chopped', '2 cups baby spinach leaves', '300ml thickened cream', '250g fresh mushrooms']) {
      const v = checkPantry(['1 can tomatoes', bad]);
      expect(v.ok, `should reject "${bad}"`).toBe(false);
    }
  });

  it('fails CLOSED on ingredients it cannot place', () => {
    const v = checkPantry(['1 can tomatoes', '3 zorblatt fronds']);
    expect(v.ok).toBe(false);
    expect(v.unknown).toContain('3 zorblatt fronds');
  });

  it('keeps storage words as signal but strips quantities and notes', () => {
    // "(freshly made)" in a note must not disqualify a frozen pie shell.
    expect(foodOf('1 9-inch pie shell, frozen (freeze for half an hour if freshly made)')).toContain('frozen');
    expect(foodOf('2 cups (210 g) pecans, coarsely chopped')).toBe('pecans coarsely');
  });

  it('distinguishes dried herbs from fresh ones', () => {
    expect(checkPantry(['1 tsp dried oregano', '1 can beans']).ok).toBe(true);
    expect(checkPantry(['1/4 cup fresh basil leaves', '1 can beans']).ok).toBe(false);
  });
});

describe('Empty-Fridge browse page', () => {
  const page = buildBrowsePages(data.recipes).find((p) => p.slug === 'empty-fridge');

  it('is published and has real depth', () => {
    expect(page, 'empty-fridge page should clear the MIN_RECIPES gate').toBeTruthy();
    expect(page!.recipes.length).toBeGreaterThanOrEqual(20);
    expect(page!.recipes.length).toBeGreaterThanOrEqual(MIN_RECIPES);
  });

  it('every listed recipe genuinely needs no shopping trip', () => {
    for (const r of page!.recipes) {
      const v = checkPantry(r.ingredients);
      expect(v.ok, `${r.slug} offenders=${v.offenders.join('|')} unknown=${v.unknown.join('|')}`).toBe(true);
    }
  });

  it('no listed recipe calls for fresh meat, fish or salad leaves', () => {
    const banned = /\b(fresh|chicken breast|beef mince|raw prawns?|salad leaves|baby spinach)\b/i;
    for (const r of page!.recipes) {
      // Parenthetical asides are stripped by the rule, so test the same text the rule sees.
      const seen = r.ingredients.map((i) => foodOf(i)).join(' ');
      expect(banned.test(seen), `${r.slug}: "${seen.slice(0, 80)}"`).toBe(false);
    }
  });
});
