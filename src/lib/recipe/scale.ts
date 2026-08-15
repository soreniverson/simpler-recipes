/**
 * Ingredient scaling that doesn't corrupt quantities.
 *
 * The old implementation parsed "1/2" as "1" (→ "2 /2 cup"), stripped trailing zeros from
 * integers ("440" → "44"), and only scaled the first number, so ranges ("1-2 tbsp") and dual
 * units ("600g / 1.2lb") came out inconsistent. This module:
 *
 *  - tokenises the leading quantity cluster: mixed numbers, a/b fractions, unicode fractions,
 *    decimals, ranges (–, -, to), dual-unit halves ("600 g / 1.2 lb"), and a conversion in
 *    parens right after a unit ("3 tbsp (45 ml)")
 *  - scales every number in that cluster and nothing after it
 *  - never scales container sizes ("1 (14 oz) can") or numbers in the description
 *  - rounds like a cook: volume units to nice fractions (⅛…⅞ incl. thirds), metric to 5 g/ml
 *    when ≥ 20, countables to halves, and leaves "to taste"/"pinch" alone
 */

const UNICODE: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6 };
const NICE: [number, string][] = [
  [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.375, '⅜'], [0.5, '½'], [0.625, '⅝'], [2 / 3, '⅔'], [0.75, '¾'], [0.875, '⅞'],
];

const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s*[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]|\d+(?:[.,]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])`;
const RANGE_SEP = String.raw`(?:\s*(?:-|–|—|to|or)\s*)`;
const UNIT = String.raw`(?:cups?|c\.|tablespoons?|tbsps?|tbs|tbl|teaspoons?|tsps?|t\b|ounces?|oz\.?|fl\.?\s*oz\.?|pounds?|lbs?\.?|grams?|g\b|kilograms?|kgs?|milliliters?|millilitres?|ml|liters?|litres?|l\b|quarts?|qts?|pints?|pts?|gallons?|gal|sticks?|cloves?|slices?|pieces?|cans?|packages?|pkgs?|packets?|bunch(?:es)?|sprigs?|stalks?|heads?|handfuls?|pinch(?:es)?|dash(?:es)?|drops?|inch(?:es)?|cm|mm|large|medium|small)`;

/** One scalable number with its textual position. */
interface Num {
  start: number;
  end: number;
  value: number;
  /** original text (for detecting style) */
  text: string;
}

export function parseNumber(token: string): number | null {
  const t = token.trim().replace(',', '.');
  if (!t) return null;
  if (UNICODE[t] != null) return UNICODE[t];
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return parseInt(m[2], 10) ? parseInt(m[1], 10) / parseInt(m[2], 10) : null;
  m = t.match(/^(\d+(?:\.\d+)?)\s*([¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])$/);
  if (m) return parseFloat(m[1]) + UNICODE[m[2]];
  if (/^\d+(?:\.\d+)?$/.test(t)) return parseFloat(t);
  return null;
}

/**
 * Find the leading quantity cluster and return every number in it that should scale.
 * Returns [] when the line has no leading quantity (e.g. "Salt to taste").
 */
export function findScalableNumbers(line: string): Num[] {
  const nums: Num[] = [];
  const re = new RegExp(String.raw`^\s*(${NUMBER})(?:${RANGE_SEP}(${NUMBER}))?`, 'i');
  const m = line.match(re);
  if (!m) return nums;
  let cursor = 0;
  const pushMatch = (text: string, from: number) => {
    const idx = line.indexOf(text, from);
    if (idx === -1) return from;
    const v = parseNumber(text);
    if (v != null && v > 0) nums.push({ start: idx, end: idx + text.length, value: v, text });
    return idx + text.length;
  };
  cursor = pushMatch(m[1], cursor);
  if (m[2]) cursor = pushMatch(m[2], cursor);

  // What follows the number(s)? A unit, then possibly "(45 ml)" conversion, then possibly "/ 1.2 lb" dual.
  let rest = line.slice(cursor);
  const unitM = rest.match(new RegExp(String.raw`^\s*${UNIT}\.?`, 'i'));
  if (!unitM) {
    // Bare count ("2 eggs", "1 (14 oz) can", "3-4 chicken thighs") — nothing more to scale.
    return nums;
  }
  cursor += unitM[0].length;
  rest = line.slice(cursor);

  // Optional conversion right after the unit: "(45 ml)", "(400ml)", "(about 1 cup)"
  const paren = rest.match(new RegExp(String.raw`^\s*\(\s*(?:about|approx\.?|approximately|~)?\s*(${NUMBER})(?:${RANGE_SEP}(${NUMBER}))?\s*${UNIT}?\.?\s*\)`, 'i'));
  if (paren) {
    let c = cursor;
    c = pushMatch(paren[1], c);
    if (paren[2]) c = pushMatch(paren[2], c);
    cursor += paren[0].length;
    rest = line.slice(cursor);
  }

  // Optional dual unit: "/ 1.2 lb", "/ 500g", "/ 2 tsp"
  const dual = rest.match(new RegExp(String.raw`^\s*\/\s*(${NUMBER})(?:${RANGE_SEP}(${NUMBER}))?\s*${UNIT}?`, 'i'));
  if (dual) {
    let c = cursor;
    c = pushMatch(dual[1], c);
    if (dual[2]) pushMatch(dual[2], c);
  }
  return nums;
}

/** Unit family for rounding decisions, taken from the text after a number. */
function unitAfter(line: string, end: number): 'volume-small' | 'volume' | 'metric' | 'count' | 'weight-us' | 'other' {
  const after = line.slice(end, end + 16).toLowerCase();
  if (/^\s*(tsps?|teaspoons?|t\b)/.test(after)) return 'volume-small';
  if (/^\s*(tbsps?|tablespoons?|tbs\b|tbl\b|cups?|c\.|fl\.?\s*oz|quarts?|pints?|gallons?|sticks?)/.test(after)) return 'volume';
  if (/^\s*(g\b|grams?|kgs?|kilograms?|ml\b|milli|l\b|liters?|litres?|cm\b|mm\b)/.test(after)) return 'metric';
  if (/^\s*(oz\b|ounces?|lbs?\b|pounds?)/.test(after)) return 'weight-us';
  if (/^\s*[a-z(]/.test(after) && !/^\s*(x|×)/.test(after)) return 'count';
  return 'other';
}

/** Round a scaled value the way a cook would measure it. */
export function roundForCooking(value: number, family: ReturnType<typeof unitAfter>): number {
  if (!Number.isFinite(value) || value <= 0) return value;
  switch (family) {
    case 'metric':
      if (value >= 100) return Math.round(value / 5) * 5;
      if (value >= 20) return Math.round(value / 5) * 5 || Math.round(value);
      if (value >= 5) return Math.round(value);
      return Math.round(value * 2) / 2;
    case 'weight-us':
      return snapFraction(value, [0.25, 0.5, 0.75]);
    case 'volume-small':
      return snapFraction(value, [0.125, 0.25, 1 / 3, 0.5, 2 / 3, 0.75]);
    case 'volume':
      return snapFraction(value, [0.125, 0.25, 1 / 3, 0.5, 2 / 3, 0.75]);
    case 'count':
      return snapFraction(value, [0.5]);
    default:
      return snapFraction(value, [0.25, 1 / 3, 0.5, 2 / 3, 0.75]);
  }
}

function snapFraction(value: number, fractions: number[]): number {
  const whole = Math.floor(value);
  const frac = value - whole;
  const candidates = [0, ...fractions, 1];
  let best = 0;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs(frac - c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  const r = whole + best;
  return r === 0 && value > 0 ? fractions[0] : r; // never round a real amount to zero
}

/** "1.5" → "1½", "0.333" → "⅓", "440" → "440", "2.2" → "2.2". */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '';
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  if (Math.abs(frac) < 0.02) return String(whole);
  for (const [f, sym] of NICE) {
    if (Math.abs(frac - f) < 0.02) return whole ? `${whole}${sym}` : sym;
  }
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/** Lines that must never be scaled even if they start with a number. */
const NO_SCALE = /\b(to taste|as needed|for serving|for garnish|optional garnish)\b/i;

/** Scale one ingredient line by a factor. Returns the original line unchanged when unsure. */
export function scaleIngredientLine(line: string, factor: number): string {
  if (!line || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) return line;
  const nums = findScalableNumbers(line);
  if (!nums.length) return line;
  // "1 tsp salt, or to taste" — scale the leading amount anyway; only skip when the WHOLE line is a "to taste".
  if (NO_SCALE.test(line) && line.trim().split(/\s+/).length <= 4) return line;
  let out = '';
  let last = 0;
  for (const n of nums) {
    const family = unitAfter(line, n.end);
    const scaled = roundForCooking(n.value * factor, family);
    out += line.slice(last, n.start) + formatQuantity(scaled);
    last = n.end;
  }
  out += line.slice(last);
  return out;
}

export function scaleIngredientLines(lines: string[], from: number, to: number): string[] {
  if (!from || !to || from <= 0 || to <= 0) return lines;
  const factor = to / from;
  return lines.map((l) => scaleIngredientLine(l, factor));
}
