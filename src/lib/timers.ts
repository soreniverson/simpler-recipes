/**
 * Detect cooking durations in step text so Cook Mode can offer a one-tap timer.
 *
 * Conservative: only clear "N minutes / N hours / N–M minutes / N ½ hours" phrases, and only in
 * a cooking context (bake, simmer, rest, cook, boil, chill, …) OR any explicit "for N minutes".
 * Never invents a timer from "350 degrees" or "20 cookies".
 */

export interface DetectedTimer {
  /** Seconds. For ranges, the LOWER bound (you can always add time; you can't un-burn). */
  seconds: number;
  /** Human label, e.g. "20 min", "1 hr 30 min", "8–10 min". */
  label: string;
  /** The matched phrase in the step text. */
  match: string;
}

const UNIT = '(hours?|hrs?|hr\\.|h\\b|minutes?|mins?|min\\.|m\\b|seconds?|secs?|sec\\.)';
const NUM = '(\\d+(?:[.,]\\d+)?(?:\\s*(?:½|¼|¾|1\\/2|1\\/4|3\\/4))?|½|¼|¾|an?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|forty-five|sixty|ninety)';
const RANGE = `${NUM}(?:\\s*(?:-|–|—|to|or)\\s*${NUM})?`;
const RE = new RegExp(`\\b${RANGE}\\s*${UNIT}`, 'gi');

const WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, sixty: 60, ninety: 90,
};

function num(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (WORDS[t] != null) return WORDS[t];
  const frac: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '1/2': 0.5, '1/4': 0.25, '3/4': 0.75 };
  const m = t.match(/^(\d+(?:[.,]\d+)?)?\s*(½|¼|¾|1\/2|1\/4|3\/4)?$/);
  if (!m) return null;
  const whole = m[1] ? parseFloat(m[1].replace(',', '.')) : 0;
  const f = m[2] ? frac[m[2]] : 0;
  const v = whole + f;
  return v > 0 ? v : null;
}

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return 3600;
  if (u.startsWith('s')) return 1;
  return 60;
}

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  if (m) return `${m} min`;
  return `${s} sec`;
}

/** Contexts where a duration is a timer, not a description ("marinate 30 minutes" yes; "20-minute recipe" no). */
const NON_TIMER = /\b(recipe|total|prep(?:aration)?|ago|later|old|minute[- ]rice|hour[- ]glass)\b/i;

export function detectTimers(text: string): DetectedTimer[] {
  const out: DetectedTimer[] = [];
  if (!text) return out;
  RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text))) {
    const [full, a, b, unit] = m;
    // Reject "20-minute recipe" style adjectives and "for the last 5 minutes of the hour" oddities.
    const after = text.slice(m.index + full.length, m.index + full.length + 12);
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    if (NON_TIMER.test(after) || NON_TIMER.test(before)) continue;
    const va = num(a);
    if (va == null) continue;
    const secs = unitSeconds(unit);
    const lower = va * secs;
    const vb = b ? num(b) : null;
    if (lower < 15 || lower > 24 * 3600) continue; // ignore "5 seconds" and multi-day
    const rounded = Math.round(lower);
    let label = fmt(rounded);
    if (vb != null && vb > va) {
      const lo = fmt(rounded);
      const hi = fmt(Math.round(vb * secs));
      // "8 min–10 min" → "8–10 min" when both share one unit; otherwise keep both units.
      const m1 = lo.match(/^(\d+) (min|hr)$/);
      const m2 = hi.match(/^(\d+) (min|hr)$/);
      label = m1 && m2 && m1[2] === m2[2] ? `${m1[1]}–${m2[1]} ${m1[2]}` : `${lo}–${hi}`;
    }
    out.push({ seconds: rounded, label, match: full.trim() });
  }
  // Dedupe identical timers.
  const seen = new Set<number>();
  return out.filter((t) => (seen.has(t.seconds) ? false : (seen.add(t.seconds), true)));
}

/** mm:ss or h:mm:ss for a countdown display. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}
