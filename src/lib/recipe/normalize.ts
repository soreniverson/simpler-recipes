/**
 * Field-level normalizers used by every extraction path (JSON-LD, microdata, AI, YouTube).
 * Pure functions, no I/O. All exported for unit tests.
 */
import { decodeHTML } from 'entities';

// ---------- Text ----------

/** Decode HTML entities (named, decimal, hex) — full HTML5 table via `entities`. */
export function decodeEntities(input: unknown): string {
  if (typeof input !== 'string') return '';
  if (!input.includes('&')) return input;
  return decodeHTML(input);
}

/** Strip HTML tags, decode entities, normalise whitespace. Keeps text only. */
export function cleanText(input: unknown): string {
  if (input == null) return '';
  let s = typeof input === 'string' ? input : String(input);
  // Common block boundaries → space so "…flour<br>Mix" doesn't glue words.
  s = s.replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, ' ');
  s = s.replace(/<[^>]*>/g, '');
  s = decodeEntities(s);
  s = s
    .replace(/ /g, ' ') // nbsp
    .replace(/[​‌‍﻿]/g, '') // zero-width
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
  return s;
}

/** Remove "1." / "Step 1:" / "1)" numbering prefixes that sites embed in step text. */
export function stripStepNumbering(step: string): string {
  return step
    .replace(/^\s*(step\s*)?\d{1,2}\s*[.):\-–—]\s+/i, '')
    .replace(/^\s*step\s+\d{1,2}\s*[:.\-–—]?\s*/i, '')
    .trim();
}

// ---------- Durations ----------

/**
 * Parse an ISO 8601 duration (PT1H30M, P0DT0H15M0.000S, PT90M, P1D…) or a human string
 * ("1 hr 30 min", "90 minutes", "1.5 hours", "45 mins", "2 hours") into total minutes.
 * Returns null when it can't be understood or is zero/negative.
 */
export function durationToMinutes(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return input > 0 && Number.isFinite(input) ? Math.round(input) : null;
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;

  // ISO 8601
  const iso = s.match(/^P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i);
  if (iso) {
    const n = (v: string | undefined) => (v ? parseFloat(v.replace(',', '.')) : 0);
    const days = n(iso[3]) * 7 + n(iso[4]) + n(iso[2]) * 30 + n(iso[1]) * 365;
    const minutes = days * 24 * 60 + n(iso[5]) * 60 + n(iso[6]) + n(iso[7]) / 60;
    const rounded = Math.round(minutes);
    return rounded > 0 ? rounded : null;
  }

  // Human: collect every "<num> <unit>" pair.
  let total = 0;
  let found = false;
  const re = /(\d+\s*[¼½¾⅓⅔]|\d+\s+\d\/\d|\d\/\d|[¼½¾⅓⅔]|\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|m\b|seconds?|secs?|s\b|days?|d\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    found = true;
    const q = parseQuantityToken(m[1]);
    const unit = m[2].toLowerCase();
    if (unit.startsWith('h')) total += q * 60;
    else if (unit.startsWith('d')) total += q * 24 * 60;
    else if (unit.startsWith('s')) total += q / 60;
    else total += q;
  }
  if (found) {
    const r = Math.round(total);
    return r > 0 ? r : null;
  }
  // Bare number → minutes (e.g. "30")
  if (/^\d+$/.test(s)) {
    const r = parseInt(s, 10);
    return r > 0 ? r : null;
  }
  return null;
}

function parseQuantityToken(t: string): number {
  const uni: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
  if (uni[t] != null) return uni[t];
  const mixedUni = t.match(/^(\d+)\s*([¼½¾⅓⅔⅛])$/);
  if (mixedUni) return parseInt(mixedUni[1], 10) + uni[mixedUni[2]];
  const mixed = t.match(/^(\d+)\s+(\d)\/(\d)$/);
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
  const frac = t.match(/^(\d)\/(\d)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  return parseFloat(t.replace(',', '.'));
}

/** "1 hr 30 min", "45 min", "2 hr", "1 day 2 hr". */
export function formatMinutes(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const m = Math.round(minutes);
  const days = Math.floor(m / 1440);
  const hrs = Math.floor((m % 1440) / 60);
  const mins = m % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hrs) parts.push(`${hrs} hr`);
  if (mins) parts.push(`${mins} min`);
  return parts.join(' ') || null;
}

/** ISO 8601 for schema output: PT1H30M. */
export function minutesToIso(minutes: number | null | undefined): string | undefined {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return undefined;
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `PT${h ? `${h}H` : ''}${mm || !h ? `${mm}M` : ''}`;
}

/** Convenience: any duration input → human string. */
export function normalizeDuration(input: unknown): string | null {
  return formatMinutes(durationToMinutes(input));
}

// ---------- Yield / servings ----------

export interface NormalizedYield {
  /** Human display: "4 servings", "12 cookies", "1 loaf". null if unknown. */
  text: string | null;
  /** Numeric count usable for scaling (servings or pieces). null if unknown/ambiguous. */
  count: number | null;
}

const YIELD_NOISE = /\b(makes|yields?|serves|servings?|serving\(s\)|about|approx\.?|approximately|around|recipe\s+yields?)\b[:.]?/gi;

/**
 * Normalise recipeYield in all its shapes: 4, "4", "4 servings", ["4", "4 servings"],
 * "Serves 4-6", "4 serving(s)", "Makes 12 cookies", "1 9-inch pie", "Cuts into 10 slices".
 */
export function normalizeYield(input: unknown): NormalizedYield {
  if (input == null) return { text: null, count: null };
  if (Array.isArray(input)) {
    // Prefer the most descriptive non-empty entry; count from the numeric one.
    const items = input
      .map((x) => ({ y: normalizeYield(x), bare: typeof x === 'number' || (typeof x === 'string' && /^\s*\d+(?:[.,]\d+)?\s*$/.test(x)) }))
      .filter((e) => e.y.text);
    if (!items.length) return { text: null, count: null };
    const withCount = items.find((e) => e.y.count != null);
    // Prefer a descriptive entry ("12 muffins") over a bare number ("12").
    const descriptive = items.filter((e) => !e.bare);
    const pick = (descriptive.length ? descriptive : items).reduce((a, b) => (b.y.text!.length > a.y.text!.length ? b : a));
    return { text: pick.y.text, count: withCount?.y.count ?? null };
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return { text: null, count: null };
    return { text: `${input} servings`, count: input };
  }
  if (typeof input === 'object') {
    // QuantitativeValue { value, unitText }
    const o = input as any;
    if (o.value != null) {
      const v = normalizeYield(o.value);
      const unit = typeof o.unitText === 'string' ? cleanText(o.unitText) : '';
      if (unit && v.count != null) return { text: `${v.count} ${unit}`, count: v.count };
      return v;
    }
    return { text: null, count: null };
  }
  if (typeof input !== 'string') return { text: null, count: null };

  let s = cleanText(input);
  if (!s) return { text: null, count: null };
  s = s.replace(/serving\(s\)/gi, 'servings');

  // Extract the first number (supports ranges "4-6", "4 to 6", mixed numbers "2 1/2", unicode "2½").
  const NUM = '(\\d+(?:[.,]\\d+)?(?:\\s*[¼½¾⅓⅔⅛]|\\s+\\d\\/\\d)?|[¼½¾⅓⅔⅛]|\\d\\/\\d)';
  const numMatch = s.match(new RegExp(`${NUM}(?:\\s*(?:-|–|to)\\s*${NUM})?`));
  let count: number | null = null;
  if (numMatch) {
    const a = parseQuantityToken(numMatch[1].replace(',', '.'));
    const b = numMatch[2] ? parseQuantityToken(numMatch[2].replace(',', '.')) : null;
    // For ranges use the lower bound (a recipe "serves 4–6" scales from 4).
    count = b != null ? Math.min(a, b) : a;
    if (!Number.isFinite(count) || count <= 0 || count > 1000) count = null;
    else if (!Number.isInteger(count)) count = Math.round(count * 100) / 100;
  }

  // Build display text.
  let text = s.replace(/\s+/g, ' ').trim();
  // Bare number → "N servings"
  if (/^\d+(?:[.,]\d+)?(?:\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?)?$/i.test(text)) text = `${text} servings`;
  // "4 servings servings" guard, and "Servings: 4" → "4 servings"
  else if (/^servings?\s*:?\s*\d+/i.test(text)) text = text.replace(/^servings?\s*:?\s*/i, '') + ' servings';
  // "Serves 4" / "Serves: 4-6" → "4–6 servings"; "Yield: 12" → "12 servings"
  else if (/^(serves|yield|yields|makes)\s*:?\s*\d+(?:[.,]\d+)?(?:\s*(?:-|–|to)\s*\d+)?\s*$/i.test(text)) {
    text = text.replace(/^(serves|yield|yields|makes)\s*:?\s*/i, '').replace(/\s*(-|to)\s*/i, '–') + ' servings';
  }
  // Ranges: "4-6 servings" → "4–6 servings"
  text = text.replace(/(\d)\s*(?:-|to)\s*(\d)/i, '$1–$2');
  // Capitalise first letter, cap length.
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (text.length > 60) text = text.slice(0, 57).trimEnd() + '…';
  // If the string is pure noise ("servings"), drop it.
  if (!/\d/.test(text) && text.replace(YIELD_NOISE, '').trim() === '') return { text: null, count: null };
  return { text, count };
}

// ---------- Images ----------

/** Pick the best image URL out of string | ImageObject | array of either. */
export function normalizeImage(input: unknown, baseUrl?: string): string | null {
  const candidates: string[] = [];
  const push = (v: unknown) => {
    if (!v) return;
    if (typeof v === 'string') candidates.push(v);
    else if (Array.isArray(v)) v.forEach(push);
    else if (typeof v === 'object') {
      const o = v as any;
      push(o.url ?? o.contentUrl ?? o['@id'] ?? o.thumbnailUrl);
    }
  };
  push(input);
  for (const raw of candidates) {
    const s = raw.trim();
    if (!s) continue;
    if (s.startsWith('data:')) continue;
    try {
      const u = new URL(s, baseUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      // Skip obvious tracking pixels / placeholders.
      if (/1x1|pixel|blank\.gif|spacer\.gif|placeholder/i.test(u.pathname)) continue;
      return u.toString();
    } catch {
      continue;
    }
  }
  return null;
}

// ---------- Ingredients ----------

export interface Section<T> {
  name: string | null;
  items: T[];
}

/**
 * Detect ingredient lines that are really section headers ("For the sauce:", "SAUCE",
 * "Dressing", "For the Chicken Marinade"). Heuristics, conservative.
 */
export function isIngredientHeader(line: string): boolean {
  const s = line.trim();
  if (!s || s.length > 60) return false;
  if (/^for\s+(the\s+)?[a-z].*:?$/i.test(s) && !/\d/.test(s)) return true; // "For the sauce"
  if (/:$/.test(s) && !/\d/.test(s) && s.split(/\s+/).length <= 6) return true; // "Sauce:"
  if (s === s.toUpperCase() && /^[A-Z][A-Z\s&'\-]{2,}$/.test(s) && !/\d/.test(s)) return true; // "TOPPING"
  return false;
}

/**
 * Split a flat ingredient list into sections using embedded header lines.
 * Returns groups; the flat list (headers removed) is derivable by concatenating items.
 */
export function groupIngredients(lines: string[]): Section<string>[] {
  const groups: Section<string>[] = [];
  let current: Section<string> = { name: null, items: [] };
  for (const raw of lines) {
    const line = cleanIngredientLine(raw);
    if (!line) continue;
    if (isIngredientHeader(line)) {
      if (current.items.length || current.name) groups.push(current);
      current = { name: prettifyHeader(line), items: [] };
      continue;
    }
    current.items.push(line);
  }
  if (current.items.length || current.name) groups.push(current);
  // Drop empty named groups (header with nothing under it).
  return groups.filter((g) => g.items.length);
}

function prettifyHeader(h: string): string {
  let s = h.replace(/:$/, '').trim();
  s = s.replace(/^for\s+(the\s+)?/i, '');
  if (s === s.toUpperCase()) s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Cleanup applied to every ingredient line. */
export function cleanIngredientLine(raw: unknown): string {
  let s = cleanText(raw);
  if (!s) return '';
  s = s
    .replace(/^[-•*·▢□☐]\s*/, '') // bullets
    .replace(/\(\(([^)]+)\)\)/g, '($1)') // ((x)) → (x)
    .replace(/\(\s*,\s*/g, '(') // ( , x) → (x)
    .replace(/\s*,\s*\)/g, ')')
    .replace(/\(\s*\)/g, '') // empty parens
    .replace(/\s+([,;.])/g, '$1') // space before punctuation
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s;
}

// ---------- Instructions ----------

/**
 * Turn recipeInstructions in any shape into ordered sections of clean step strings.
 * Handles: string (with numbering / newlines / <p> / <li>), string[], HowToStep[],
 * HowToSection[] (nested itemListElement), ItemList, mixed arrays, objects with text/name.
 */
export function normalizeInstructions(input: unknown): Section<string>[] {
  const sections: Section<string>[] = [];
  let current: Section<string> = { name: null, items: [] };
  const flush = () => {
    if (current.items.length) sections.push(current);
    current = { name: null, items: [] };
  };
  const addStep = (text: unknown) => {
    const t = stripStepNumbering(cleanText(text));
    if (!t) return;
    // Some sites put "Ingredients: …" or a heading as a step — drop pure headers.
    if (t.length < 3) return;
    // Avoid exact duplicate consecutive steps (some sites emit name===text twice).
    if (current.items[current.items.length - 1] === t) return;
    current.items.push(t);
  };
  const walk = (node: unknown, depth = 0): void => {
    if (node == null || depth > 6) return;
    if (typeof node === 'string') {
      for (const s of splitInstructionString(node)) addStep(s);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, depth + 1));
      return;
    }
    if (typeof node === 'object') {
      const o = node as any;
      const type = String(o['@type'] ?? '').toLowerCase();
      if (type.includes('howtosection') || (o.itemListElement && !o.text && !type.includes('howtostep'))) {
        flush();
        current.name = cleanText(o.name) || null;
        walk(o.itemListElement, depth + 1);
        flush();
        return;
      }
      if (type.includes('howtostep') || o.text || o.name) {
        // A HowToStep may itself carry itemListElement of HowToDirection/HowToTip.
        if (o.text) addStep(o.text);
        else if (Array.isArray(o.itemListElement) && o.itemListElement.length) walk(o.itemListElement, depth + 1);
        else if (o.name) addStep(o.name);
        return;
      }
      if (o.itemListElement) {
        walk(o.itemListElement, depth + 1);
        return;
      }
    }
  };
  walk(input);
  flush();
  // Merge sections without a name into neighbours only when everything is unnamed.
  if (sections.every((s) => !s.name)) {
    const merged = sections.flatMap((s) => s.items);
    return merged.length ? [{ name: null, items: merged }] : [];
  }
  return sections;
}

/** Split a single instructions string into steps. */
export function splitInstructionString(s: string): string[] {
  let text = s;
  // Prefer explicit list markup when present.
  if (/<li[\s>]/i.test(text)) {
    const items = [...text.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => cleanText(m[1]));
    if (items.filter(Boolean).length > 1) return items.filter(Boolean);
  }
  if (/<p[\s>]/i.test(text)) {
    const items = [...text.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => cleanText(m[1]));
    if (items.filter(Boolean).length > 1) return items.filter(Boolean);
  }
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]*>/g, ' ');
  text = decodeEntities(text);
  // Newlines
  let parts = text.split(/\r?\n+/).map((x) => x.trim()).filter(Boolean);
  // "1. Do x. 2. Do y." embedded numbering
  if (parts.length === 1) {
    const numbered = parts[0].split(/(?:^|\s)(?=(?:step\s*)?\d{1,2}[.)]\s+[A-Z])/i).map((x) => x.trim()).filter(Boolean);
    if (numbered.length > 1) parts = numbered;
  }
  return parts;
}

// ---------- Author / site ----------

export function normalizeAuthor(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === 'string') return cleanText(input) || null;
  if (Array.isArray(input)) {
    const names = input.map(normalizeAuthor).filter(Boolean) as string[];
    return names.length ? [...new Set(names)].slice(0, 3).join(', ') : null;
  }
  if (typeof input === 'object') {
    const o = input as any;
    return normalizeAuthor(o.name) || null;
  }
  return null;
}

/** Keywords: "a, b, c" | ["a","b"] → string[] (deduped, max 15). */
export function normalizeKeywords(input: unknown, extra: unknown[] = []): string[] {
  const out: string[] = [];
  const add = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(add);
    if (typeof v !== 'string') return;
    for (const part of v.split(/[,;]/)) {
      const k = cleanText(part).toLowerCase();
      if (k && k.length <= 40 && !out.includes(k)) out.push(k);
    }
  };
  add(input);
  extra.forEach(add);
  return out.slice(0, 15);
}
