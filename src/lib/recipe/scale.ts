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

const NUMBER = String.raw`(?:\d+\s+(?:and\s+)?\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s*[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]|\d+(?:[.,]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])`;
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
  let m = t.match(/^(\d+)\s+(?:and\s+)?(\d+)\/(\d+)$/);
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

  // "+ 2 tbsp" / "+ 1 egg yolk" addends after a quantity: scale each one too.
  const addends = (from: number) => {
    let c = from;
    // up to two plain words may sit between the quantity and the "+" ("1 large egg + 1 egg yolk")
    const re = new RegExp(String.raw`^\s*(?:[A-Za-z-]+,?\s+){0,2}(?:\+|plus)\s*(${NUMBER})(?:\s*${UNIT}\.?)?`, 'i');
    for (let guard = 0; guard < 4; guard++) {
      const am = line.slice(c).match(re);
      if (!am) break;
      c = pushMatch(am[1], c);
      // skip past the unit (if any) so the next "+" is found
      const after = line.slice(c).match(new RegExp(String.raw`^\s*${UNIT}\.?`, 'i'));
      if (after) c += after[0].length;
    }
  };

  // What follows the number(s)? A unit, then possibly "(45 ml)" conversion, then possibly "/ 1.2 lb" dual.
  let rest = line.slice(cursor);
  const unitM = rest.match(new RegExp(String.raw`^\s*${UNIT}\.?`, 'i'));
  if (!unitM) {
    // Bare count ("2 eggs", "1 (14 oz) can", "3-4 chicken thighs"). Only "+ N …" addends may follow.
    addends(cursor);
    return nums;
  }
  cursor += unitM[0].length;
  rest = line.slice(cursor);
  // "1 can (14 oz) beans": the parenthetical after a container is its size, not a conversion.
  if (CONTAINER_UNIT.test(unitM[0].trim().replace(/\.$/, ''))) return nums;

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
    if (dual[2]) c = pushMatch(dual[2], c);
    cursor = c;
    const u = line.slice(cursor).match(new RegExp(String.raw`^\s*${UNIT}\.?`, 'i'));
    if (u) cursor += u[0].length;
  }
  addends(cursor);
  return nums;
}

/** Unit family for rounding decisions, taken from the text after a number. */
function unitAfter(line: string, end: number): 'volume-small' | 'volume' | 'metric' | 'metric-large' | 'count' | 'weight-us' | 'other' {
  const after = line.slice(end, end + 16).toLowerCase();
  if (/^\s*(tsps?|teaspoons?|t\b)/.test(after)) return 'volume-small';
  if (/^\s*(tbsps?|tablespoons?|tbs\b|tbl\b|cups?|c\.|fl\.?\s*oz|quarts?|pints?|gallons?|sticks?)/.test(after)) return 'volume';
  if (/^\s*(kgs?\b|kilograms?|l\b|liters?|litres?)/.test(after)) return 'metric-large';
  if (/^\s*(g\b|grams?|ml\b|milli|cm\b|mm\b)/.test(after)) return 'metric';
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
    case 'metric-large':
      // 1.2 kg × ¼ = 0.3 kg, not ½ kg; one decimal like recipes write it.
      return Math.round(value * 10) / 10 || Math.round(value * 100) / 100;
    case 'weight-us':
      return snapFraction(value, [0.25, 0.5, 0.75]);
    case 'volume-small':
      return snapFraction(value, [0.125, 0.25, 1 / 3, 0.5, 2 / 3, 0.75]);
    case 'volume':
      return snapFraction(value, [0.125, 0.25, 1 / 3, 0.5, 2 / 3, 0.75]);
    case 'count':
      // "6 cloves" × 1.75 → 11, not 10½. Halves only make sense under ~1 (½ an onion).
      return value >= 1.25 ? Math.round(value) : snapFraction(value, [0.5]);
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

/** Units whose number we pluralise/singularise to match the scaled quantity. */
const PLURAL_UNIT = /^(cup|tablespoon|teaspoon|clove|slice|piece|can|sprig|stalk|head|handful|stick|ounce|pound|gram|quart|pint|bunch|package|packet|inch|pinch|dash|box)(s|es)?$/i;
/** Container units: a parenthetical after these is a size ("2 cans (400 g each)"), never scaled. */
const CONTAINER_UNIT = /^(cans?|tins?|jars?|bottles?|packages?|pkgs?|packets?|boxe?s?|bags?|sticks?)$/i;
/** Volume conversions for amounts that get too small to measure in the original unit. */
const MEASURE_UNIT = String.raw`(?:cups?|c\.|tablespoons?|tbsps?|tbs|tbl|teaspoons?|tsps?|ounces?|oz\.?|fl\.?\s*oz\.?|pounds?|lbs?\.?|grams?|g\b|kilograms?|kgs?|milliliters?|millilitres?|ml|liters?|litres?|l\b|quarts?|qts?|pints?|pts?)`;
const PAREN_FORBIDDEN = /\b(each|can|cans|tin|tins|jar|jars|package|packet|pkg|box|bag|inch|inches|cm|mm|x|×|%|°|from|of|for)\b|["″]/i;

/** Common countable nouns whose number should agree with a bare count ("2 egg" → "2 eggs"). */
const NOUNS: Record<string, string> = {
  egg: 'eggs', onion: 'onions', potato: 'potatoes', tomato: 'tomatoes', carrot: 'carrots', apple: 'apples', banana: 'bananas',
  lemon: 'lemons', lime: 'limes', orange: 'oranges', pepper: 'peppers', avocado: 'avocados', shallot: 'shallots', cucumber: 'cucumbers',
  clove: 'cloves', breast: 'breasts', thigh: 'thighs', drumstick: 'drumsticks', fillet: 'fillets', sausage: 'sausages', tortilla: 'tortillas',
  bun: 'buns', roll: 'rolls', leaf: 'leaves', chilli: 'chillies', chili: 'chilies', jalapeño: 'jalapeños', jalapeno: 'jalapenos',
  scallion: 'scallions', mushroom: 'mushrooms', peach: 'peaches', pear: 'pears', date: 'dates', biscuit: 'biscuits', cookie: 'cookies',
  bagel: 'bagels', bulb: 'bulbs', leek: 'leeks', bunch: 'bunches', pinch: 'pinches', dash: 'dashes', handful: 'handfuls', steak: 'steaks', chop: 'chops', wing: 'wings', leg: 'legs', ear: 'ears', stalk: 'stalks', sprig: 'sprigs',
};
const NOUN_SINGULAR: Record<string, string> = Object.fromEntries(Object.entries(NOUNS).map(([a, b]) => [b, a]));
const NOUN_ALT = [...Object.keys(NOUNS), ...Object.values(NOUNS)].sort((a, b) => b.length - a.length).join('|');
const NOUN_SKIP = /^(large|medium|small|extra-large|xl|jumbo|ripe|whole|fresh|big|little|free-range|organic|raw|cooked|hard-boiled|soft-boiled|red|green|yellow|white|brown|sweet|russet|roma|plum|cherry|baby|spring|boneless|skinless|bone-in|skin-on|thick|thin|heaped|heaping|level)$/i;

interface Piece {
  start: number;
  end: number;
  text: string;
}

/** Scale the numbers in `nums`, then fix the unit token shared by the leading cluster. */
function applyScaling(line: string, nums: Num[], factor: number): string {
  if (!nums.length) return line;
  // Unit token: first alphabetic token after the first number ("1-2 tbsp" → "tbsp"; "600 g / 1.2 lb" → "g").
  const firstEnd = nums[0].end;
  const unitM = line.slice(firstEnd).match(/^([\s\d\/.,¼½¾⅓⅔⅛⅜⅝⅞\-–—]*?(?:to|or)?\s*)([A-Za-z.]+)/);
  let unitTok: Piece | null = null;
  if (unitM) {
    const start = firstEnd + unitM[1].length;
    unitTok = { start, end: start + unitM[2].length, text: unitM[2] };
  }
  const unitLower = unitTok?.text.toLowerCase().replace(/\.$/, '') ?? '';
  // Numbers that share that unit token (the leading range), vs. later conversions/dual units.
  const cluster = unitTok ? nums.filter((n) => n.end <= unitTok!.start) : nums;
  const clusterMax = Math.max(...cluster.map((n) => n.value * factor));

  let mult = 1;
  let newUnit: string | null = null;
  if (/^(tbsps?|tablespoons?|tbs|tbl)$/.test(unitLower) && clusterMax < 1) {
    mult = 3;
    newUnit = 'tsp';
  } else if (/^(cups?|c)$/.test(unitLower) && clusterMax <= 0.125 + 1e-9) {
    mult = 16;
    newUnit = 'tbsp';
  }

  // First pass: scaled values (the unit token's number depends on the cluster's max).
  const scaledOf = new Map<Num, number>();
  let clusterFinalMax = 0;
  for (const n of nums) {
    const inCluster = cluster.includes(n);
    const family = newUnit === 'tsp' && inCluster ? 'volume-small' : newUnit === 'tbsp' && inCluster ? 'volume' : unitAfter(line, n.end);
    const scaled = roundForCooking(n.value * factor * (inCluster ? mult : 1), family);
    if (inCluster) clusterFinalMax = Math.max(clusterFinalMax, scaled);
    scaledOf.set(n, scaled);
  }
  let unitText: string | null = null;
  if (unitTok) {
    let tok = unitTok.text;
    if (newUnit) {
      // Keep the author's style: "tablespoons" → "teaspoon(s)", "tbsp" → "tsp", "cups" → "tbsp".
      if (newUnit === 'tsp') tok = /^tablespoons?$/i.test(tok) ? (clusterFinalMax > 1 ? 'teaspoons' : 'teaspoon') : 'tsp';
      else tok = 'tbsp';
    } else {
      const pm = tok.match(PLURAL_UNIT);
      if (pm) {
        const base = pm[1];
        const es = /^(inch|bunch|pinch|dash|box)$/i.test(base);
        tok = clusterFinalMax > 1 ? base + (es ? 'es' : 's') : base;
        if (unitTok.text[0] === unitTok.text[0].toUpperCase()) tok = tok[0].toUpperCase() + tok.slice(1);
      }
    }
    unitText = tok;
  }

  // Second pass: splice numbers and the unit token back in positional order.
  const pieces: { start: number; end: number; text: string }[] = nums.map((n) => ({ start: n.start, end: n.end, text: formatQuantity(scaledOf.get(n)!) }));
  if (unitTok && unitText != null) pieces.push({ start: unitTok.start, end: unitTok.end, text: unitText });
  pieces.sort((a, b) => a.start - b.start);
  let out = '';
  let last = 0;
  for (const p of pieces) {
    if (p.start < last) continue;
    out += line.slice(last, p.start) + p.text;
    last = p.end;
  }
  out += line.slice(last);
  return out;
}

/** Bare count ("2 large eggs", "1 boneless, skinless chicken breast"): make the first whitelisted noun agree. */
function agreeNoun(line: string, count: number): string {
  const m = line.match(/^(\s*\S+\s+)(.*)$/);
  if (!m) return line;
  const words = m[2].split(/(\s+)/); // keep separators
  let seen = 0;
  for (let i = 0; i < words.length && seen < 6; i += 2) {
    const raw = words[i];
    if (!raw) continue;
    seen++;
    const core = raw.replace(/[,;:.]+$/, '');
    const punct = raw.slice(core.length);
    const lower = core.toLowerCase();
    // "kaffir lime leaves", "egg yolks", "tomato sauce", "orange or green pepper": a listed noun used
    // as a modifier — the real noun comes later. Skip it (leaving a line unchanged beats mangling it).
    const nextCore = (words[i + 2] || '').replace(/[,;:.]+$/, '').toLowerCase();
    const isNoun = !!(NOUNS[lower] || NOUN_SINGULAR[lower]);
    const nextIsNoun = !!(NOUNS[nextCore] || NOUN_SINGULAR[nextCore]);
    const nextIsTail = /^(sauce|paste|pur[ée]e|juice|zest|yolks?|whites?|stock|broth|powder|oil|butter|milk|cream|flour|water|extract|seeds?|leaves|leaf|syrup|jam|jelly|salsa|soup|wine|vinegar|skin|peel|rind|slices?|wedges?|halves|quarters|or|and|&)$/i.test(nextCore) || (/s$/.test(nextCore) && !/ss$/.test(nextCore));
    if (isNoun && !punct && (nextIsNoun || nextIsTail)) continue;
    let repl: string | null = null;
    if (count > 1 && NOUNS[lower]) repl = NOUNS[lower];
    else if (count <= 1 && NOUN_SINGULAR[lower]) repl = NOUN_SINGULAR[lower];
    else if (NOUNS[lower] || NOUN_SINGULAR[lower]) return line; // already agrees
    if (repl) {
      if (core[0] === core[0].toUpperCase()) repl = repl[0].toUpperCase() + repl.slice(1);
      words[i] = repl + punct;
      return m[1] + words.join('');
    }
    // stop at the first clause break — the noun is in the first clause
    if (/[,;:]$/.test(raw)) {
      // keep scanning only if we haven't found a noun yet; "boneless, skinless chicken breast" needs it
      continue;
    }
  }
  return line;
}

/**
 * Quantities inside LATER parentheticals — "(~1½ tbsp)", "(about 2 cups)", "(⅓ cup + 1 tbsp)" —
 * scaled only when the leading cluster had a real (non-container) unit and the parenthetical
 * has no size/each/from language.
 */
function scaleLaterParens(line: string, from: number, factor: number, skipLeading = false): string {
  let out = line.slice(0, from);
  let rest = line.slice(from);
  const parenRe = /\(([^()]*)\)/g;
  let m: RegExpExecArray | null;
  let cursor = 0;
  while ((m = parenRe.exec(rest))) {
    const inner = m[1];
    out += rest.slice(cursor, m.index);
    cursor = m.index + m[0].length;
    // "1 (14 oz) can": the paren glued to a bare count is a container size.
    const leading = skipLeading && !/\S/.test(rest.slice(0, m.index));
    if (leading || PAREN_FORBIDDEN.test(inner) || !/\d|[¼½¾⅓⅔⅛⅜⅝⅞]/.test(inner)) {
      out += m[0];
      continue;
    }
    // Scale each "NUMBER [- NUMBER] UNIT" chunk inside.
    const chunkRe = new RegExp(String.raw`(${NUMBER})(?:${RANGE_SEP}(${NUMBER}))?\s*(?:(?:heaping|heaped|level|scant|generous|rounded|large|medium|small)\s+)?(${MEASURE_UNIT}|${NOUN_ALT})(?![A-Za-z])`, 'gi');
    let innerOut = '';
    let ic = 0;
    let cm: RegExpExecArray | null;
    let any = false;
    while ((cm = chunkRe.exec(inner))) {
      const chunk = cm[0];
      const nums: Num[] = [];
      let p = 0;
      for (const tok of [cm[1], cm[2]].filter(Boolean) as string[]) {
        const at = chunk.indexOf(tok, p);
        const v = parseNumber(tok);
        if (at >= 0 && v != null && v > 0) nums.push({ start: at, end: at + tok.length, value: v, text: tok });
        p = at + tok.length;
      }
      if (!nums.length) continue;
      any = true;
      innerOut += inner.slice(ic, cm.index) + applyScaling(chunk, nums, factor);
      ic = cm.index + chunk.length;
    }
    if (!any) {
      out += m[0];
      continue;
    }
    innerOut += inner.slice(ic);
    out += '(' + innerOut + ')';
  }
  out += rest.slice(cursor);
  return out;
}

/** Scale one ingredient line by a factor. Returns the original line unchanged when unsure. */
export function scaleIngredientLine(line: string, factor: number): string {
  if (!line || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) return line;
  const nums = findScalableNumbers(line);
  if (!nums.length) return line;
  // "1 tsp salt, or to taste" — scale the leading amount anyway; only skip when the WHOLE line is a "to taste".
  if (NO_SCALE.test(line) && line.trim().split(/\s+/).length <= 4) return line;

  const lastEnd = nums[nums.length - 1].end;
  const unitM = line.slice(lastEnd).match(/^\s*([A-Za-z.]+)/);
  const unitWord = unitM ? unitM[1].replace(/\.$/, '') : '';
  const hasUnit = !!unitWord && new RegExp(String.raw`^${UNIT}$`, 'i').test(unitWord);
  const isContainer = CONTAINER_UNIT.test(unitWord);

  // Split: head (leading cluster + its unit) gets scaled; tail may contain later parentheticals.
  const headEnd = unitM ? lastEnd + unitM[0].length : lastEnd;
  const head = applyScaling(line.slice(0, headEnd), nums, factor);
  let tail = line.slice(headEnd);
  if (!isContainer) tail = scaleLaterParens(tail, 0, factor, !hasUnit);
  let out = head + tail;

  if (!hasUnit || /^(large|medium|small)$/i.test(unitWord)) {
    // Bare count: fix noun number ("1 onion" → "2 onions").
    const first = roundForCooking(nums[0].value * factor, 'count');
    out = agreeNoun(out, first);
  }
  return out;
}

export function scaleIngredientLines(lines: string[], from: number, to: number): string[] {
  if (!from || !to || from <= 0 || to <= 0) return lines;
  const factor = to / from;
  return lines.map((l) => scaleIngredientLine(l, factor));
}
