/**
 * Tiny, safe localStorage layer. Everything user-side in this app is local-first and
 * account-free: recently extracted recipes, checked-off ingredients/steps, Cook Mode position.
 *
 * All functions are no-ops (returning sane defaults) when storage is unavailable
 * (SSR, private mode, quota exceeded, disabled).
 */

export function hasStorage(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const k = '__sr_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Broadcast a change so other islands on the page can react. */
export function emit(name: string, detail?: unknown): void {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    /* ignore */
  }
}

/** Short, URL-safe, deterministic id from a string (FNV-1a 32-bit, base36). */
export function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
