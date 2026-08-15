// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';

// Minimal localStorage + window shim for node.
class MemStorage {
  private m = new Map<string, string>();
  quotaFail = false;
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { if (this.quotaFail) throw new Error('QuotaExceeded'); this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
}
const storage = new MemStorage();
(globalThis as any).window = { localStorage: storage, dispatchEvent: () => true };
(globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };

const { rememberRecipe, getRecentRecipe, listRecentRecipes, forgetRecentRecipe, idForSource, latestRecentRecipe, RECENT_KEY, LEGACY_KEY, MAX_RECENT } = await import('../src/lib/recentRecipes');
const { getCookState, toggleIngredient, toggleStep, setCookState, resetCookState, COOK_STATE_TTL_MS } = await import('../src/lib/cookState');
const { shortHash } = await import('../src/lib/storage');

const recipe = (title: string) => ({ title, description: null, ingredients: ['a', 'b'], instructions: ['x'], prepTime: null, cookTime: null, totalTime: null, servings: null, image: null }) as any;

beforeEach(() => { storage.clear(); storage.quotaFail = false; });

describe('shortHash', () => {
  it('is stable and short', () => {
    expect(shortHash('hello')).toBe(shortHash('hello'));
    expect(shortHash('hello')).not.toBe(shortHash('hellp'));
    expect(shortHash('https://x.com/a').length).toBeLessThan(10);
  });
});

describe('recentRecipes', () => {
  it('drops malformed stored entries instead of surfacing them', () => {
    rememberRecipe(recipe('Good'), 'https://x.com/good');
    const raw = JSON.parse(storage.getItem(RECENT_KEY)!);
    raw.items.push({ id: 'bad1', recipe: { title: { not: 'a string' }, ingredients: [], instructions: [] }, sourceUrl: 'https://x.com/bad', savedAt: 1, openedAt: 1 });
    raw.items.push('garbage');
    raw.items.push({ id: 'bad2' });
    storage.setItem(RECENT_KEY, JSON.stringify(raw));
    const list = listRecentRecipes();
    expect(list).toHaveLength(1);
    expect(list[0].recipe.title).toBe('Good');
  });
  it('remembers and retrieves by id derived from canonical URL', () => {
    const id = rememberRecipe(recipe('A'), 'https://www.x.com/r/?utm_source=z');
    expect(idForSource('https://x.com/r')).toBe(id);
    expect(getRecentRecipe(id)!.recipe.title).toBe('A');
    expect(latestRecentRecipe()!.id).toBe(id);
  });
  it('re-saving the same source updates in place', () => {
    rememberRecipe(recipe('A'), 'https://x.com/r');
    rememberRecipe(recipe('A2'), 'https://x.com/r');
    expect(listRecentRecipes()).toHaveLength(1);
    expect(listRecentRecipes()[0].recipe.title).toBe('A2');
  });
  it('orders most recent first and caps', () => {
    for (let i = 0; i < MAX_RECENT + 5; i++) rememberRecipe(recipe(`R${i}`), `https://x.com/${i}`);
    const list = listRecentRecipes();
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0].recipe.title).toBe(`R${MAX_RECENT + 4}`);
  });
  it('forgets', () => {
    const id = rememberRecipe(recipe('A'), 'https://x.com/r');
    forgetRecentRecipe(id);
    expect(getRecentRecipe(id)).toBe(null);
  });
  it('migrates the legacy single slot', () => {
    storage.setItem(LEGACY_KEY, JSON.stringify({ recipe: recipe('Legacy'), sourceUrl: 'https://old.com/r' }));
    expect(listRecentRecipes()[0].recipe.title).toBe('Legacy');
  });
  it('survives quota errors', () => {
    rememberRecipe(recipe('A'), 'https://x.com/1');
    storage.quotaFail = true;
    expect(() => rememberRecipe(recipe('B'), 'https://x.com/2')).not.toThrow();
  });
  it('ignores corrupt data', () => {
    storage.setItem(RECENT_KEY, '{not json');
    expect(listRecentRecipes()).toEqual([]);
  });
});

describe('cookState', () => {
  it('toggles ingredients and steps', () => {
    toggleIngredient('r1', 2);
    toggleIngredient('r1', 0);
    expect(getCookState('r1').ingredients).toEqual([0, 2]);
    toggleIngredient('r1', 2);
    expect(getCookState('r1').ingredients).toEqual([0]);
    toggleStep('r1', 1);
    expect(getCookState('r1').steps).toEqual([1]);
  });
  it('is isolated per recipe and resets', () => {
    toggleIngredient('a', 1);
    expect(getCookState('b').ingredients).toEqual([]);
    resetCookState('a');
    expect(getCookState('a').ingredients).toEqual([]);
  });
  it('expires after 24h', () => {
    setCookState('old', { ingredients: [1] });
    const raw = JSON.parse(storage.getItem('sr:cook:old')!);
    raw.updatedAt = Date.now() - COOK_STATE_TTL_MS - 1000;
    storage.setItem('sr:cook:old', JSON.stringify(raw));
    expect(getCookState('old').ingredients).toEqual([]);
  });
  it('removes the key when state becomes empty', () => {
    toggleIngredient('e', 1);
    toggleIngredient('e', 1);
    expect(storage.getItem('sr:cook:e')).toBe(null);
  });
});
