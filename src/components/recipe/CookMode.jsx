import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { detectTimers, formatCountdown } from '../../lib/timers';
import Ingredients from './Ingredients';
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon, TimerIcon, CheckIcon } from './Icons';

/**
 * Cook Mode — designed for a phone on the counter, three feet away, wet hands.
 *
 *  - one step at a time, 26–36px type, nothing else on screen
 *  - Prev / Next: full-height 56px buttons, swipe left/right, ← → keys, space
 *  - Ingredients: bottom sheet you can open without losing your place (check-off shared with page)
 *  - Timers: durations found in the step ("bake 20 minutes") become one-tap timers; a running timer
 *    stays visible on every step, buzzes + beeps when done
 *  - remembers your step (24h) so a lock screen or accidental exit doesn't lose your place
 *  - screen stays awake (Wake Lock) while open
 *  - exit needs a deliberate tap on the ✕ or Esc; Done on the last step
 */
export default function CookMode({ recipe, currentStep, onStepChange, checkedIngredients, onToggleIngredient, onResetIngredients, servings, onServingsChange, onClose, onStepDone }) {
  const steps = recipe.instructions;
  const total = steps.length;
  const [step, setStep] = useState(() => Math.min(Math.max(0, currentStep || 0), Math.max(0, total - 1)));
  const [showIngredients, setShowIngredients] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const prevFocus = useRef(null);
  const wakeLockRef = useRef(null);
  const touch = useRef(null);
  const [announce, setAnnounce] = useState('');

  const isFirst = step === 0;
  const isLast = step === total - 1;
  const text = steps[step] || '';
  const long = text.length > 230;
  const timers = useMemo(() => detectTimers(text), [text]);

  const go = useCallback(
    (n) => {
      const next = Math.min(Math.max(0, n), total - 1);
      setStep(next);
      onStepChange?.(next);
      setAnnounce(`Step ${next + 1} of ${total}`);
    },
    [total, onStepChange]
  );

  // Focus management: focus dialog on open, restore on close.
  useEffect(() => {
    prevFocus.current = document.activeElement;
    // Focus the dialog itself (not the close button) so the first thing read is the step.
    dialogRef.current?.focus();
    return () => {
      prevFocus.current?.focus?.();
    };
  }, []);

  // Body scroll lock.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Wake lock (ref, not state — the old code captured a stale null and never released).
  useEffect(() => {
    let cancelled = false;
    async function request() {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          const lock = await navigator.wakeLock.request('screen');
          if (cancelled) lock.release();
          else wakeLockRef.current = lock;
        }
      } catch {
        /* not available or denied — fine */
      }
    }
    request();
    const onVis = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      wakeLockRef.current?.release?.().catch?.(() => {});
      wakeLockRef.current = null;
    };
  }, []);

  // Keyboard.
  useEffect(() => {
    function onKey(e) {
      if (e.defaultPrevented) return;
      const tag = e.target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showIngredients) setShowIngredients(false);
        else onClose();
        return;
      }
      if (typing || showIngredients) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' && e.target === dialogRef.current) {
        e.preventDefault();
        if (!isLast) go(step + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!isFirst) go(step - 1);
      } else if (e.key === 'Home') {
        go(0);
      } else if (e.key === 'End') {
        go(total - 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, isFirst, isLast, go, onClose, showIngredients, total]);

  // Focus trap.
  useEffect(() => {
    function trap(e) {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, []);

  // Swipe.
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    const dt = Date.now() - touch.current.t;
    touch.current = null;
    if (dt > 700 || Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    if (dx < 0 && !isLast) go(step + 1);
    else if (dx > 0 && !isFirst) go(step - 1);
  };

  const finish = () => {
    onStepDone?.(step);
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cook-mode-title"
      tabIndex={-1}
      className="fixed inset-0 z-[60] bg-background text-sand-900 flex flex-col outline-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-2 px-2 sm:px-4 h-14">
        <button ref={closeRef} type="button" onClick={onClose} className="btn-icon" aria-label="Exit cook mode">
          <CloseIcon className="w-5 h-5" />
        </button>
        <div className="min-w-0 text-center">
          <p id="cook-mode-title" className="text-[13px] text-sand-500 truncate px-2">
            <span className="sr-only">Cook mode: </span>
            {recipe.title}
          </p>
          <p className="text-[14px] font-medium tabular text-sand-800" aria-hidden="true">
            Step {step + 1} of {total}
          </p>
        </div>
        <button type="button" onClick={() => setShowIngredients(true)} className="btn-icon" aria-label="Show ingredients" aria-expanded={showIngredients} aria-controls="cook-ingredients">
          <ListIcon className="w-5 h-5" />
        </button>
      </header>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announce}
      </span>

      {/* Progress */}
      <div className="shrink-0 mx-4 h-1 rounded-full bg-sand-200 overflow-hidden" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} aria-label="Progress">
        <div className="h-full bg-sand-700 rounded-full transition-[width] duration-200" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>

      {/* Running timers */}
      <TimerBar />

      {/* Step */}
      <main className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-6 flex flex-col">
        {/* my-auto (not items-center) so long steps scroll from the top instead of clipping. */}
        <div className={`w-full mx-auto my-auto ${long ? 'max-w-[34ch] sm:max-w-[40ch]' : 'max-w-[28ch] sm:max-w-[30ch]'}`}>
          <p key={step} className={`${long ? 'text-[22px] sm:text-[26px] lg:text-[30px] leading-[1.35]' : 'text-[26px] sm:text-[32px] lg:text-[36px] leading-[1.3]'} text-sand-900 [text-wrap:pretty]`}>
            {text}
          </p>
          {timers.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 no-print">
              {timers.map((t) => (
                <TimerButton key={t.seconds} timer={t} stepIndex={step} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Nav */}
      <footer className="shrink-0 px-4 pb-4 pt-2">
        <div className="flex items-stretch gap-3 max-w-xl mx-auto">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={isFirst}
            className="flex-1 h-14 rounded-xl bg-sand-100 text-sand-800 text-[16px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-sand-200 transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back
          </button>
          {isLast ? (
            <button type="button" onClick={finish} className="flex-[1.4] h-14 rounded-xl bg-sand-900 text-sand-50 text-[16px] font-medium inline-flex items-center justify-center gap-2 hover:bg-sand-800 transition-colors">
              <CheckIcon className="w-5 h-5" />
              Done
            </button>
          ) : (
            <button type="button" onClick={() => go(step + 1)} className="flex-[1.4] h-14 rounded-xl bg-sand-900 text-sand-50 text-[16px] font-medium inline-flex items-center justify-center gap-2 hover:bg-sand-800 transition-colors">
              Next
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </footer>

      {/* Ingredients sheet */}
      {showIngredients && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
          <button type="button" className="absolute inset-0 bg-sand-950/30" aria-label="Close ingredients" onClick={() => setShowIngredients(false)} />
          <div id="cook-ingredients" role="dialog" aria-label="Ingredients" className="relative bg-sand-50 rounded-t-2xl shadow-lg max-h-[80vh] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-between px-5 pt-3 pb-1">
              <span className="w-10 h-1 rounded-full bg-sand-300 absolute left-1/2 -translate-x-1/2 top-2" aria-hidden="true" />
              <span className="text-[13px] text-sand-500 mt-2">Tap to check off</span>
              <button type="button" onClick={() => setShowIngredients(false)} className="btn-icon -mr-2" aria-label="Close ingredients">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-6">
              <Ingredients
                recipe={recipe}
                checked={checkedIngredients}
                onToggle={onToggleIngredient}
                onReset={onResetIngredients}
                servings={servings}
                onServingsChange={onServingsChange}
                compact
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Timers ---------------- */
// Module-level so timers keep running across step changes and re-renders (but not across page loads).
const timerStore = { list: [], subs: new Set() };
function emitTimers() {
  timerStore.subs.forEach((fn) => fn([...timerStore.list]));
}
function startTimer(label, seconds, stepIndex) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  timerStore.list.push({ id, label, endsAt: Date.now() + seconds * 1000, total: seconds, stepIndex, done: false });
  emitTimers();
  return id;
}
function stopTimer(id) {
  timerStore.list = timerStore.list.filter((t) => t.id !== id);
  emitTimers();
}
function useTimers() {
  const [list, setList] = useState(() => [...timerStore.list]);
  useEffect(() => {
    timerStore.subs.add(setList);
    return () => timerStore.subs.delete(setList);
  }, []);
  return list;
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.25, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(now + t);
      o.stop(now + t + 0.22);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    /* no audio */
  }
}

function TimerBar() {
  const list = useTimers();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!list.length) return;
    const i = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const t of timerStore.list) {
        if (!t.done && t.endsAt <= now) {
          t.done = true;
          changed = true;
          beep();
          try {
            navigator.vibrate?.([200, 100, 200, 100, 400]);
          } catch {}
        }
      }
      if (changed) emitTimers();
      tick((n) => n + 1);
    }, 250);
    return () => clearInterval(i);
  }, [list.length]);
  if (!list.length) return null;
  return (
    <div className="shrink-0 px-4 pt-3 flex flex-wrap gap-2 justify-center" role="status" aria-live="polite">
      {list.map((t) => {
        const remaining = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
        return (
          <div key={t.id} className={`inline-flex items-center gap-2 pl-3 pr-1 h-10 rounded-full text-[15px] tabular font-medium ${t.done ? 'bg-sand-900 text-sand-50 animate-pulse' : 'bg-sand-100 text-sand-900'}`}>
            <TimerIcon className="w-4 h-4" />
            <span>{t.done ? 'Time’s up' : formatCountdown(remaining)}</span>
            <span className="text-sand-500 font-normal text-[13px]">step {t.stepIndex + 1}</span>
            <button type="button" onClick={() => stopTimer(t.id)} className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-sand-200/60" aria-label={t.done ? 'Dismiss timer' : 'Cancel timer'}>
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TimerButton({ timer, stepIndex }) {
  const list = useTimers();
  const running = list.find((t) => t.stepIndex === stepIndex && t.total === timer.seconds && !t.done);
  if (running) {
    return (
      <span className="inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-sand-100 text-sand-600 text-[15px]">
        <TimerIcon className="w-4 h-4" /> Timer running
      </span>
    );
  }
  return (
    <button type="button" onClick={() => startTimer(timer.label, timer.seconds, stepIndex)} className="btn-secondary">
      <TimerIcon className="w-4 h-4" />
      Start {timer.label} timer
    </button>
  );
}
