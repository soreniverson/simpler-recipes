/**
 * Kitchen timers — a tiny module-level store that outlives any component.
 *
 * Why not component state: a timer started in Cook Mode must keep running (and ring!) after
 * Cook Mode is closed, and survive an accidental reload. So the store owns the tick, the alarm,
 * and persistence (sessionStorage — per tab, absolute end times so reloads are exact).
 *
 * Audio: iOS Safari only lets a page make sound from an AudioContext created/resumed inside a
 * user gesture. `primeAudio()` is called from the Start-timer tap; the alarm reuses that context.
 * Ringing repeats every 2s until dismissed and the tab title flashes so a backgrounded tab still
 * gets attention. `navigator.vibrate` is used where it exists (not iOS).
 */

const KEY = 'sr:timers:v1';
const TICK_MS = 250;
const RING_EVERY_MS = 2000;

/** @typedef {{ id: string, label: string, endsAt: number, total: number, stepIndex: number, done: boolean, lastRing?: number }} Timer */

/** @type {{ list: Timer[], subs: Set<(list: Timer[]) => void>, interval: any, audio: AudioContext | null, title: string | null, titleFlip: boolean }} */
const store = { list: [], subs: new Set(), interval: null, audio: null, title: null, titleFlip: false };

function persist() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (store.list.length) sessionStorage.setItem(KEY, JSON.stringify(store.list.map(({ lastRing, ...t }) => t)));
    else sessionStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

function restore() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    store.list = list.filter((t) => t && typeof t.id === 'string' && typeof t.endsAt === 'number' && typeof t.total === 'number');
    if (store.list.length) ensureTicking();
  } catch { /* ignore */ }
}

function emit() {
  const snapshot = store.list.map((t) => ({ ...t }));
  store.subs.forEach((fn) => fn(snapshot));
}

/** Call from a user gesture (the Start-timer tap) so iOS lets us play the alarm later. */
export function primeAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!store.audio) store.audio = new Ctx();
    if (store.audio.state === 'suspended') store.audio.resume().catch(() => {});
  } catch { /* no audio */ }
}

function ring() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = store.audio || (store.audio = new Ctx());
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.3, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(now + t);
      o.stop(now + t + 0.22);
    });
  } catch { /* no audio */ }
  try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch { /* ignore */ }
}

function flashTitle(on) {
  if (typeof document === 'undefined') return;
  if (on) {
    if (store.title == null) store.title = document.title;
    store.titleFlip = !store.titleFlip;
    document.title = store.titleFlip ? '⏰ Time’s up' : store.title;
  } else if (store.title != null) {
    document.title = store.title;
    store.title = null;
    store.titleFlip = false;
  }
}

function tick() {
  const now = Date.now();
  let changed = false;
  let ringing = false;
  for (const t of store.list) {
    if (!t.done && t.endsAt <= now) {
      t.done = true;
      changed = true;
    }
    if (t.done) {
      ringing = true;
      if (!t.lastRing || now - t.lastRing >= RING_EVERY_MS) {
        t.lastRing = now;
        ring();
        flashTitle(true);
      }
    }
  }
  if (!ringing) flashTitle(false);
  if (changed) persist();
  // Subscribers re-render every tick so countdowns move; cheap (a few nodes).
  emit();
}

function ensureTicking() {
  if (store.interval || typeof window === 'undefined') return;
  store.interval = setInterval(() => {
    tick();
    if (!store.list.length) {
      clearInterval(store.interval);
      store.interval = null;
      flashTitle(false);
    }
  }, TICK_MS);
}

/** Start a timer. `seconds` total, `label` like "20 min", `stepIndex` 0-based. Returns id. */
export function startTimer(label, seconds, stepIndex) {
  primeAudio();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  store.list.push({ id, label, endsAt: Date.now() + seconds * 1000, total: seconds, stepIndex, done: false });
  persist();
  ensureTicking();
  emit();
  return id;
}

/** Cancel a running timer or dismiss a finished one. */
export function stopTimer(id) {
  store.list = store.list.filter((t) => t.id !== id);
  persist();
  if (!store.list.some((t) => t.done)) flashTitle(false);
  emit();
}

/** Dismiss every finished timer (the takeover's single button). */
export function dismissFinished() {
  store.list = store.list.filter((t) => !t.done);
  persist();
  flashTitle(false);
  emit();
}

export function getTimers() {
  return store.list.map((t) => ({ ...t }));
}

/** Subscribe to changes + ticks. Returns unsubscribe. */
export function subscribeTimers(fn) {
  store.subs.add(fn);
  return () => store.subs.delete(fn);
}

/** Seconds left (0 when done). */
export function remainingSeconds(t, now = Date.now()) {
  return Math.max(0, Math.round((t.endsAt - now) / 1000));
}

if (typeof window !== 'undefined') restore();
