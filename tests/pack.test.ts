import { describe, it, expect } from 'vitest';
import { packRecipe, unpackRecipe, packedId, MAX_PACKED_CHARS } from '../src/lib/recipe/pack';

const recipe = {
  title: 'Weeknight Chicken Thighs',
  description: 'Crispy skin, one pan.',
  ingredients: ['6 bone-in chicken thighs', '1 tbsp olive oil', '1 tsp kosher salt', '½ tsp black pepper'],
  instructions: ['Pat the thighs dry and season.', 'Sear skin-side down 8 minutes.', 'Flip, then roast at 425°F for 15 minutes.'],
  servings: '4 servings',
  totalTime: '35 min',
} as any;

describe('packRecipe / unpackRecipe', () => {
  it('round-trips a recipe with its source URL', async () => {
    const payload = await packRecipe(recipe, 'https://example.com/chicken');
    expect(payload).toMatch(/^1~[A-Za-z0-9_-]+$/); // URL-safe, versioned
    const out = await unpackRecipe(payload);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.recipe.title).toBe(recipe.title);
      expect(out.recipe.ingredients).toEqual(recipe.ingredients);
      expect(out.recipe.instructions).toEqual(recipe.instructions);
      expect(out.sourceUrl).toBe('https://example.com/chicken');
    }
  });

  it('round-trips without a source URL', async () => {
    const out = await unpackRecipe(await packRecipe(recipe));
    expect(out.ok && out.sourceUrl).toBe(null);
  });

  it('compresses: payload is smaller than the JSON it carries', async () => {
    const big = { ...recipe, instructions: Array(40).fill('Stir the pot gently and wait for the sauce to thicken before the next step.') };
    const payload = await packRecipe(big);
    expect(payload.length).toBeLessThan(JSON.stringify(big).length);
  });

  it('rejects garbage without throwing', async () => {
    for (const bad of [null, undefined, 42, '', '1~', '1~!!!not-base64!!!', '9~AAAA', 'AAAA', '1~AAAA', 'x'.repeat(MAX_PACKED_CHARS + 1)]) {
      expect((await unpackRecipe(bad)).ok).toBe(false);
    }
  });

  it('rejects payloads whose JSON is not a valid recipe', async () => {
    const forged = await packRecipe({ nope: true } as any).catch(() => null);
    // packRecipe itself doesn't validate (server does), so build one by hand via the public API:
    if (forged) expect((await unpackRecipe(forged)).ok).toBe(false);
  });

  it('packedId is stable and short', async () => {
    const payload = await packRecipe(recipe);
    expect(packedId(payload)).toBe(packedId(payload));
    expect(packedId(payload).length).toBeLessThan(10);
  });
});
