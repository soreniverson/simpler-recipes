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

/** Shape check for one stored entry. Anything malformed (hand-edited storage, an old bug,
 *  another tab on a different version) is dropped instead of crashing the island that renders it. */
function isEntry(x: unknown): x is RecentEntry {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  const r = e.recipe as Record<string, unknown> | undefined;
  return (
    typeof e.id === 'string' &&
    typeof e.sourceUrl === 'string' &&
    typeof e.savedAt === 'number' &&
    typeof e.openedAt === 'number' &&
    !!r &&
    typeof r === 'object' &&
    typeof r.title === 'string' &&
    Array.isArray(r.ingredients) &&
    (r.ingredients as unknown[]).every((x) => typeof x === 'string') &&
    Array.isArray(r.instructions) &&
    (r.instructions as unknown[]).every((x) => typeof x === 'string')
  );
}

/** Per-tab fallback for the rare device where localStorage is full or disabled. */
const FALLBACK_KEY = 'sr:recent:fallback';
function readFallback(): RecentEntry | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(FALLBACK_KEY);
    if (!raw) return null;
    const e = JSON.parse(raw);
    return isEntry(e) ? e : null;
  } catch {
    return null;
  }
}
function writeFallback(e: RecentEntry): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    sessionStorage.setItem(FALLBACK_KEY, JSON.stringify(e));
    return true;
  } catch {
    return false;
  }
}

function load(): Store {
  const s = readJson<Store | null>(RECENT_KEY, null);
  if (s && s.v === 1 && Array.isArray(s.items)) {
    const items = s.items.filter(isEntry);
    return { v: 1, items };
  }
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

/** Returns false when nothing could be persisted (quota exhausted / storage disabled). */
function save(store: Store): boolean {
  // Trim to cap (most recently opened first).
  store.items.sort((a, b) => b.openedAt - a.openedAt);
  store.items = store.items.slice(0, MAX_RECENT);
  let ok = writeJson(RECENT_KEY, store);
  if (!ok) {
    // Quota: drop the oldest half and retry, then keep only the newest.
    store.items = store.items.slice(0, Math.max(1, Math.floor(store.items.length / 2)));
    ok = writeJson(RECENT_KEY, store);
    if (!ok) {
      store.items = store.items.slice(0, 1);
      ok = writeJson(RECENT_KEY, store);
    }
  }
  emit(RECENT_EVENT);
  return ok;
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
  if (!save(store)) {
    // Last resort so the recipe the user just extracted is not lost on the way to /recipe.
    const entry = store.items.find((i) => i.id === id);
    if (entry) writeFallback(entry);
  }
  return id;
}

export function getRecentRecipe(id: string): RecentEntry | null {
  const store = load();
  const found = store.items.find((i) => i.id === id);
  if (found) return found;
  const fb = readFallback();
  return fb && fb.id === id ? fb : null;
}

/**
 * Open an extracted recipe from anywhere (favorites, meal plan): make sure it's in Recent under
 * its stable id, then go to its address. Replaces writing the legacy single slot + `/recipe`.
 */
export function openExtractedRecipe(recipe: Recipe, sourceUrl?: string | null): void {
  const src = sourceUrl || (recipe as any).sourceUrl || `local:${encodeURIComponent(recipe.title || 'recipe')}`;
  const id = rememberRecipe(recipe, src);
  window.location.href = `/recipe?r=${id}`;
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
