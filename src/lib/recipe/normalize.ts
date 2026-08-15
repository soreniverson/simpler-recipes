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

/**
 * Strip cross-references to the source page's notes/video ("(Note 3)", "(see notes)",
 * "(Note 4, also Video helpful here)") — meaningless once the recipe is on its own.
 */
export function stripSourceRefs(s: string): string {
  return s
    .replace(/\s*\(\s*(?:see\s+)?notes?\s*\d+(?:\s*(?:,|&|and)\s*\d+)*(?:\s*,\s*[^)]{0,40})?\s*\)/gi, '')
    .replace(/\s*\(\s*(?:see\s+)?(?:recipe\s+)?notes?\s*\)/gi, '')
    .replace(/\s*\(\s*(?:see\s+)?video\s*(?:helpful\s+here|above|below)?\s*\)/gi, '')
    .replace(/\s*\((?:see|refer to)\s+(?:the\s+)?(?:notes?|video)[^)]{0,30}\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;.!?])/g, '$1')
    .trim();
}

/** Remove "1." / "Step 1:" / "1)" numbering prefixes that sites embed in step text. */
export function stripStepNumbering(step: string): string {
  return step
    .replace(/^\s*(step\s*)?\d{1,2}\s*[.):\-–—]\s+/i, '')
    .replace(/^\s*step\s+\d{1,2}\s*[:.\-–—]?\s*/i, '')
    .trim();
}

// ---------- Durations & yields live in units.ts (dependency-free) ----------
export { durationToMinutes, formatMinutes, minutesToIso, normalizeDuration, normalizeYield } from './units';
export type { NormalizedYield } from './units';

// ---------- Images ----------

/** Pick the best image URL out of string | ImageObject | array of either. */
export function normalizeImage(input: unknown, baseUrl?: string): string | null {
  interface Cand { url: string; w: number | null; h: number | null; order: number }
  const candidates: Cand[] = [];
  const push = (v: unknown) => {
    if (!v) return;
    if (typeof v === 'string') candidates.push({ url: v, w: null, h: null, order: candidates.length });
    else if (Array.isArray(v)) v.forEach(push);
    else if (typeof v === 'object') {
      const o = v as any;
      const url = o.url ?? o.contentUrl ?? o['@id'] ?? o.thumbnailUrl;
      if (typeof url === 'string') {
        const w = Number(typeof o.width === 'object' ? o.width?.value : o.width) || null;
        const h = Number(typeof o.height === 'object' ? o.height?.value : o.height) || null;
        candidates.push({ url, w, h, order: candidates.length });
      } else push(url);
    }
  };
  push(input);
  const valid: Cand[] = [];
  for (const c of candidates) {
    const s = c.url.trim();
    if (!s || s.startsWith('data:')) continue;
    try {
      const u = new URL(s, baseUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      if (/1x1|pixel|blank\.gif|spacer\.gif|placeholder/i.test(u.pathname)) continue;
      // Size hints in the filename ("-500x375.jpg") when the object didn't declare them.
      let { w, h } = c;
      if (!w || !h) {
        const m = u.pathname.match(/-(\d{2,4})x(\d{2,4})\.[a-z]{3,4}$/i);
        if (m) { w = Number(m[1]); h = Number(m[2]); }
      }
      valid.push({ url: u.toString(), w, h, order: c.order });
    } catch {
      continue;
    }
  }
  if (!valid.length) return null;
  if (valid.length === 1) return valid[0].url;
  // Score: prefer landscape 4:3–16:9 (fits the recipe hero), then larger, then earlier.
  const score = (c: Cand) => {
    if (!c.w || !c.h) return 0;
    const ratio = c.w / c.h;
    const aspect = ratio >= 1.25 && ratio <= 1.85 ? 2 : ratio > 1 ? 1 : 0;
    return aspect * 1e7 + Math.min(c.w * c.h, 5e6);
  };
  const withDims = valid.filter((c) => c.w && c.h);
  if (withDims.length) {
    withDims.sort((a, b) => score(b) - score(a) || a.order - b.order);
    return withDims[0].url;
  }
  return valid[0].url;
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
  let s = h.replace(/\s*:\s*$/, '').trim();
  s = s.replace(/^for\s+(the\s+)?/i, '');
  if (s === s.toUpperCase()) s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Section names from any source: strip trailing colons / "For the", fix SHOUTING. */
export function cleanSectionName(h: unknown): string | null {
  const t = cleanText(h);
  if (!t) return null;
  const p = prettifyHeader(t);
  return p || null;
}

/** Cleanup applied to every ingredient line. */
export function cleanIngredientLine(raw: unknown): string {
  let s = stripSourceRefs(cleanText(raw));
  if (!s) return '';
  s = s
    .replace(/^[-•*·▢□☐]\s*/, '') // bullets
    .replace(/\(\s*,\s*/g, '(') // ( , x) → (x)
    .replace(/\s*,\s*\)/g, ')')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    // Price annotations (Budget Bytes style): "($0.35)", "($1.20 each)", trailing "$0.50"
    .replace(/\s*\(\s*\$\s*\d+(?:[.,]\d+)?(?:\s*(?:each|total|\/[a-z]+))?\s*\)/gi, '')
    .replace(/\s+\$\d+(?:[.,]\d+)?\b(?!\s*[a-z])/g, '')
    // Footnote markers "flour*" / "flour**"
    .replace(/(\S)\*{1,3}(?=\s|$|,)/g, '$1')
    .replace(/\(\s*\)/g, '') // empty parens
    .replace(/\s+([,;.])/g, '$1') // space before punctuation
    .replace(/\s{2,}/g, ' ')
    .trim();
  return unwrapNestedNotes(s);
}

/**
 * WPRM (and friends) wrap the whole "notes" field in parens, so notes that themselves contain
 * parens come out doubled: "onion ((or 2 small), sliced)", "lemon (juiced (about 3 tbsp))".
 * Rewrite the outer wrapper into natural prose:
 *   "1 large onion ((or 2 small onions), sliced)" → "1 large onion (or 2 small onions), sliced"
 *   "1 lemon (juiced (about 3 tablespoons))"       → "1 lemon, juiced (about 3 tablespoons)"
 * Only touches an outer group that contains a nested group; plain "(chopped)" is left alone.
 */
export function unwrapNestedNotes(input: string): string {
  let s = input;
  // Unbalanced source data ("6 scallions ((white portions only)"): drop the stray doubled paren.
  const opens = (s.match(/\(/g) || []).length;
  const closes = (s.match(/\)/g) || []).length;
  if (opens > closes && s.includes('((')) s = s.replace('((', '(');
  else if (closes > opens && s.includes('))')) s = s.replace(/\)\)(?!.*\)\))/, ')');
  // Repeat for triple-nesting "((drained (Note 1)))" and multiple groups per line.
  for (let pass = 0; pass < 3; pass++) {
    const next = unwrapOnce(s);
    if (next === s) break;
    s = next;
  }
  return s;
}

function unwrapOnce(s: string): string {
  // Walk top-level groups; rewrite the first one that contains a nested group.
  let depth = 0;
  let open = -1;
  let hasNested = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') {
      depth++;
      if (depth === 1) {
        open = i;
        hasNested = false;
      } else if (depth === 2) hasNested = true;
    } else if (c === ')' && depth > 0) {
      depth--;
      if (depth === 0 && hasNested && open !== -1) {
        const before = s.slice(0, open).replace(/\s+$/, '');
        const inner = s.slice(open + 1, i).trim();
        const after = s.slice(i + 1);
        let joined: string;
        if (inner.startsWith('(')) joined = `${before} ${inner}`; // "((or 2 small), sliced)" → "(or 2 small), sliced"
        else joined = before.endsWith(',') || before === '' ? `${before} ${inner}` : `${before}, ${inner}`; // "(juiced (about 3 tbsp))" → ", juiced (about 3 tbsp)"
        return (joined + after).replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').trim();
      }
    }
  }
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
    const cleaned = cleanText(text);
    // A single "step" that is really the whole numbered method → split it.
    if (cleaned.length > 300) {
      const pieces = splitNumberedBlob(cleaned);
      if (pieces.length > 1) {
        pieces.forEach((p) => addStep(p));
        return;
      }
    }
    const t = stripSourceRefs(stripStepNumbering(cleaned));
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
        current.name = cleanSectionName(o.name);
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
  // "1. Do x. 2. Do y." embedded numbering (only split where a number follows sentence punctuation
  // or starts the string, so "add 2. 5 cups" and "Step 2. plain" don't get shredded).
  if (parts.length === 1) parts = splitNumberedBlob(parts[0]);
  return parts;
}

/** Split "…coats the meat.2. To make the salsa… 3. Mix…" into steps when numbering is ascending. */
export function splitNumberedBlob(text: string): string[] {
  const re = /(?:^|(?<=[.!?:)\]"”])\s*)(?:step\s*)?(\d{1,2})[.)]\s+(?=[A-Z"“(])/gi;
  const marks: { idx: number; n: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) marks.push({ idx: m.index, n: parseInt(m[1], 10), len: m[0].length });
  if (marks.length < 2) return [text.trim()].filter(Boolean);
  // Require ascending numbering starting at 1 (or 2 if the blob's first step lost its label).
  const ascending = marks.every((mk, i) => (i === 0 ? mk.n <= 2 : mk.n === marks[i - 1].n + 1));
  if (!ascending) return [text.trim()].filter(Boolean);
  const out: string[] = [];
  const first = text.slice(0, marks[0].idx).trim();
  if (first) out.push(first);
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].idx + marks[i].len;
    const end = i + 1 < marks.length ? marks[i + 1].idx : text.length;
    const seg = text.slice(start, end).trim();
    if (seg) out.push(seg);
  }
  return out;
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

// ---------- Titles ----------

/** Trim SEO suffixes/prefixes from source titles: "X Recipe by Tasty", "X Recipe - Site", "X | Site". */
export function cleanTitle(input: unknown, siteName?: string | null): string {
  let t = cleanText(input);
  if (!t) return '';
  // Split off " - Site" / " | Site" / " – Site" tails when the tail is short (a site name), never a subtitle.
  const tail = t.match(/^(.{6,}?)\s+[-|–—:]\s+([^-|–—]{2,40})$/);
  if (tail) {
    const tailText = tail[2].trim();
    const looksLikeSite = /recipe|site|kitchen|eats|food|cook|baking|by\s|\.com|\.co\b/i.test(tailText) || (siteName && tailText.toLowerCase() === siteName.toLowerCase());
    if (looksLikeSite) t = tail[1].trim();
  }
  t = t.replace(/\s+recipe\s+by\s+.+$/i, '');
  t = t.replace(/\s+\(recipe\)$/i, '');
  t = t.replace(/\s+recipe$/i, (m) => (t.split(/\s+/).length > 2 ? '' : m));
  t = t.replace(/[!]+$/, '');
  return t.trim() || cleanText(input);
}
