/**
 * Local-only history of extracted recipes.
 *
 * Replaces the old single `simpler-recipes-extracted` slot (which meant a second extraction
 * silently overwrote the first, and Back/Forward lost the recipe). Every extraction gets a
 * stable id derived from its source URL, so /recipe?r=<id> is a real, revisitable address on
 * this device. Nothing leaves the browser.
 */
import type { Recipe } from './recipe/types';
import { readJson, writeJson, emit, shortHash } from './storage';
import { cacheKeyForUrl } from './url';

export const RECENT_KEY = 'sr:recent:v1';
export const LEGACY_KEY = 'simpler-recipes-extracted';
export const RECENT_EVENT = 'sr:recent-changed';
export const MAX_RECENT = 30;

export interface RecentEntry {
  id: string;
  recipe: Recipe;
  sourceUrl: string;
  /** ms epoch */
  savedAt: number;
  /** ms epoch of last open (for ordering) */
  openedAt: number;
}

export function idForSource(sourceUrl: string): string {
  return shortHash(cacheKeyForUrl(sourceUrl));
}

interface Store {
  v: 1;
  items: RecentEntry[];
}

function load(): Store {
  const s = readJson<Store | null>(RECENT_KEY, null);
  if (s && s.v === 1 && Array.isArray(s.items)) return s;
  // One-time migration from the legacy single slot.
  const legacy = readJson<{ recipe?: Recipe; sourceUrl?: string } | null>(LEGACY_KEY, null);
  const items: RecentEntry[] = [];
  if (legacy?.recipe && legacy.sourceUrl) {
    const now = Date.now();
    items.push({ id: idForSource(legacy.sourceUrl), recipe: legacy.recipe, sourceUrl: legacy.sourceUrl, savedAt: now, openedAt: now });
  }
  return { v: 1, items };
}

/** Monotonic timestamp so rapid successive saves still order deterministically. */
function nextStamp(store: Store): number {
  const max = store.items.reduce((m, i) => Math.max(m, i.openedAt || 0, i.savedAt || 0), 0);
  return Math.max(Date.now(), max + 1);
}

function save(store: Store): void {
  // Trim to cap (most recently opened first).
  store.items.sort((a, b) => b.openedAt - a.openedAt);
  store.items = store.items.slice(0, MAX_RECENT);
  if (!writeJson(RECENT_KEY, store)) {
    // Quota: drop the oldest half and retry once.
    store.items = store.items.slice(0, Math.max(1, Math.floor(store.items.length / 2)));
    writeJson(RECENT_KEY, store);
  }
  emit(RECENT_EVENT);
}

/** Save (or refresh) an extracted recipe. Returns its id. */
export function rememberRecipe(recipe: Recipe, sourceUrl: string): string {
  const store = load();
  const id = idForSource(sourceUrl);
  const now = nextStamp(store);
  const existing = store.items.find((i) => i.id === id);
  if (existing) {
    existing.recipe = recipe;
    existing.sourceUrl = sourceUrl;
    existing.openedAt = now;
  } else {
    store.items.push({ id, recipe, sourceUrl, savedAt: now, openedAt: now });
  }
  save(store);
  return id;
}

export function getRecentRecipe(id: string): RecentEntry | null {
  const store = load();
  return store.items.find((i) => i.id === id) ?? null;
}

/** Most recently opened first. */
export function listRecentRecipes(limit = MAX_RECENT): RecentEntry[] {
  return load().items.sort((a, b) => b.openedAt - a.openedAt).slice(0, limit);
}

export function touchRecentRecipe(id: string): void {
  const store = load();
  const e = store.items.find((i) => i.id === id);
  if (!e) return;
  e.openedAt = nextStamp(store);
  save(store);
}

export function forgetRecentRecipe(id: string): void {
  const store = load();
  const before = store.items.length;
  store.items = store.items.filter((i) => i.id !== id);
  if (store.items.length !== before) save(store);
}

export function clearRecentRecipes(): void {
  writeJson(RECENT_KEY, { v: 1, items: [] } satisfies Store);
  emit(RECENT_EVENT);
}

/** The most recent entry, for legacy `/recipe` (no id) navigation. */
export function latestRecentRecipe(): RecentEntry | null {
  return listRecentRecipes(1)[0] ?? null;
}
