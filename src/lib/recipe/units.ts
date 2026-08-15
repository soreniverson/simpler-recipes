/**
 * Durations and yields — pure, dependency-free so the client bundle can use them without
 * dragging in the HTML entity tables. normalize.ts re-exports everything here.
 */

/** Tag/whitespace-only cleanup (entities are decoded upstream by cleanText when needed). */
function liteClean(input: unknown): string {
  if (input == null) return '';
  return String(input).replace(/<[^>]*>/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------- Durations ----------

/**
 * Parse an ISO 8601 duration (PT1H30M, P0DT0H15M0.000S, PT90M, P1D…) or a human string
 * ("1 hr 30 min", "90 minutes", "1.5 hours", "45 mins", "2 hours") into total minutes.
 * Returns null when it can't be understood or is zero/negative.
 */
/** Anything over ~10 weeks is a markup error, not a recipe. */
const MAX_MINUTES = 100_000;

export function durationToMinutes(input: unknown): number | null {
  const n = durationToMinutesRaw(input);
  return n != null && n <= MAX_MINUTES ? n : null;
}

function durationToMinutesRaw(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return input > 0 && Number.isFinite(input) ? Math.round(input) : null;
  if (Array.isArray(input)) return durationToMinutes(input[0]);
  if (typeof input === 'object') {
    // schema.org Duration / QuantitativeValue objects: {minValue, maxValue} or {value}
    const o = input as any;
    const v = o.value ?? o.minValue ?? o.maxValue;
    if (v != null) {
      const n = durationToMinutes(v);
      if (n != null) return n;
      // Some sites put a bare number of minutes.
      const num = Number(v);
      if (Number.isFinite(num) && num > 0) return Math.round(num);
    }
    return null;
  }
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s || /(^|[^\d\s])\s*-\s*\d/.test(s)) return null; // negative durations ("PT-5M", "-30 min") are nonsense; "1-2 hours" is a range

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
      const unit = typeof o.unitText === 'string' ? liteClean(o.unitText) : '';
      if (unit && v.count != null) return { text: `${v.count} ${unit}`, count: v.count };
      return v;
    }
    return { text: null, count: null };
  }
  if (typeof input !== 'string') return { text: null, count: null };

  let s = liteClean(input);
  if (!s) return { text: null, count: null };
  // "-3", "0 servings", "1/0" are not yields.
  if (/^\s*-\s*\d/.test(s) || /^\s*0+(?:[.,]0+)?\s*(servings?|serves|people|portions?)?\s*$/i.test(s) || /\/\s*0\b/.test(s)) return { text: null, count: null };
  s = s.replace(/serving\(s\)/gi, 'servings');

  // Extract the first number (supports ranges "4-6", "4 to 6", mixed numbers "2 1/2", unicode "2½").
  const NUM = '(\\d+(?:[.,]\\d+)?(?:\\s*[¼½¾⅓⅔⅛]|\\s+\\d\\/\\d)?|[¼½¾⅓⅔⅛]|\\d\\/\\d)';
  // Prefer the number attached to a serving word: "1 loaf, 10 servings" → 10; "2 cups (8 servings)" → 8.
  const servingWord = s.match(new RegExp(`${NUM}(?:\\s*(?:-|–|to)\\s*${NUM})?\\s*(?:servings?|serves|people|persons?|portions?|personnes|porzioni)\\b`, 'i'));
  const numMatch = servingWord ?? s.match(new RegExp(`${NUM}(?:\\s*(?:-|–|to)\\s*${NUM})?`));
  let count: number | null = null;
  if (numMatch) {
    const a = parseQuantityToken(numMatch[1].replace(',', '.'));
    const b = numMatch[2] ? parseQuantityToken(numMatch[2].replace(',', '.')) : null;
    // For ranges use the lower bound (a recipe "serves 4–6" scales from 4).
    count = b != null ? Math.min(a, b) : a;
    // > 500 is a markup error, not a scaling baseline.
    if (!Number.isFinite(count) || count <= 0 || count > 500) count = null;
    else if (!Number.isInteger(count)) count = Math.round(count * 100) / 100;
  }

  // Build display text.
  let text = s.replace(/\s+/g, ' ').trim();
  // Bare number → "N servings"
  if (/^\d+(?:[.,]\d+)?(?:\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?)?$/i.test(text)) text = `${text} servings`;
  // "4 servings servings" guard, and "Servings: 4" → "4 servings"
  else if (/^servings?\s*:?\s*\d+/i.test(text)) text = text.replace(/^servings?\s*:?\s*/i, '') + ' servings';
  // "Serves 4" / "Serves: 4-6" → "4–6 servings"; "Yield: 12" → "12 servings". ("Makes 16" stays as-is:
  // it may be 16 cookies, not 16 servings.)
  else if (/^(serves|yield|yields)\s*:?\s*\d+(?:[.,]\d+)?(?:\s*(?:-|–|to)\s*\d+)?\s*$/i.test(text)) {
    text = text.replace(/^(serves|yield|yields)\s*:?\s*/i, '').replace(/\s*(-|to)\s*/i, '–') + ' servings';
  }
  // Ranges: "4-6 servings" → "4–6 servings"
  text = text.replace(/(\d)\s*(?:-|to)\s*(\d)/i, '$1–$2');
  // "1 servings" → "1 serving"
  text = text.replace(/^1 servings$/i, '1 serving');
  // "4 dozen" → 48
  const dozen = text.match(/^(\d+)\s*dozen\b/i);
  if (dozen) count = parseInt(dozen[1], 10) * 12;
  // A bare number too big to be servings ("48" cookies, "160" ml) is a count of *something*: say
  // "Makes 48" rather than "48 servings", and don't use it as a scaling baseline above 100.
  const bareBig = text.match(/^(\d+) servings$/);
  if (bareBig && parseInt(bareBig[1], 10) > 24) {
    text = `Makes ${bareBig[1]}`;
    if (parseInt(bareBig[1], 10) > 100) count = null;
  }
  // "160 ml (2/3 cup)" is a volume, not a serving count — keep the text, drop the count.
  if (/^\d+(?:[.,]\d+)?\s*(ml|g|l|kg|oz|cups?|litres?|liters?)\b/i.test(text) && !/serv|people|portion/i.test(text)) count = null;
  // Capitalise first letter, cap length.
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (text.length > 60) text = text.slice(0, 57).trimEnd() + '…';
  // If the string is pure noise ("servings"), drop it.
  if (!/\d/.test(text) && text.replace(YIELD_NOISE, '').trim() === '') return { text: null, count: null };
  return { text, count };
}

