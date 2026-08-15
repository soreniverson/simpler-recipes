import { useEffect, useState } from 'react';
import { formatCountdown } from '../../lib/timers';
import { startTimer, stopTimer, dismissFinished, getTimers, subscribeTimers, remainingSeconds } from '../../lib/timerStore';
import { TimerIcon, CloseIcon } from './Icons';

/** Live list of timers (re-renders every tick while any timer exists). */
export function useTimers() {
  const [list, setList] = useState(() => (typeof window === 'undefined' ? [] : getTimers()));
  useEffect(() => subscribeTimers(setList), []);
  return list;
}

/**
 * Running/finished timers as pills.
 *  - `size="lg"` (Cook Mode): 22px countdown, readable from the counter.
 *  - `floating` (recipe page): fixed bottom bar so a timer started in Cook Mode is still visible
 *    after closing it.
 */
export function TimerBar({ size = 'md', floating = false }) {
  const list = useTimers();
  if (!list.length) return null;
  const now = Date.now();
  const pills = list.map((t) => {
    const remaining = remainingSeconds(t, now);
    return (
      <div
        key={t.id}
        className={`inline-flex items-center gap-2 pl-3 pr-1 rounded-full tabular font-medium ${size === 'lg' ? 'h-12 text-[22px]' : 'h-10 text-[16px]'} ${t.done ? 'bg-sand-900 text-sand-50' : 'bg-sand-100 text-sand-900'}`}
      >
        <TimerIcon className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
        <span>{t.done ? 'Time’s up' : formatCountdown(remaining)}</span>
        <span className={`font-normal ${t.done ? 'text-sand-300' : 'text-sand-500'} ${size === 'lg' ? 'text-[15px]' : 'text-[13px]'}`}>step {t.stepIndex + 1}</span>
        <button
          type="button"
          onClick={() => stopTimer(t.id)}
          className={`rounded-full inline-flex items-center justify-center ${size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'} ${t.done ? 'hover:bg-sand-700' : 'hover:bg-sand-200/60'}`}
          aria-label={t.done ? `Dismiss ${t.label} timer` : `Cancel ${t.label} timer`}
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
    );
  });
  if (floating) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none no-print" role="status" aria-live="polite">
        <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pb-4 flex flex-wrap gap-2 justify-center" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="pointer-events-auto flex flex-wrap gap-2 justify-center rounded-2xl bg-background/95 backdrop-blur border border-sand-200 shadow-lg p-2">{pills}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="shrink-0 px-4 pt-3 flex flex-wrap gap-2 justify-center" role="status" aria-live="polite">
      {pills}
    </div>
  );
}

/**
 * Full-screen takeover when any timer hits zero. Rings until dismissed (see timerStore).
 * Rendered once per page (RecipeView) above Cook Mode.
 */
export function TimerAlarm() {
  const list = useTimers();
  const done = list.filter((t) => t.done);
  useEffect(() => {
    if (!done.length) return;
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dismissFinished();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [done.length]);
  if (!done.length) return null;
  const first = done[0];
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="timer-alarm-title" className="fixed inset-0 z-[80] bg-sand-900 text-sand-50 flex flex-col items-center justify-center px-6 text-center no-print">
      <TimerIcon className="w-12 h-12 mb-6 text-sand-300 animate-pulse" />
      <h2 id="timer-alarm-title" className="text-[40px] sm:text-[56px] leading-none font-semibold tracking-[-0.02em]">Time’s up</h2>
      <p className="mt-4 text-[20px] sm:text-[24px] text-sand-300">
        {first.label} timer · step {first.stepIndex + 1}
        {done.length > 1 ? ` (+${done.length - 1} more)` : ''}
      </p>
      <button
        type="button"
        onClick={dismissFinished}
        autoFocus
        className="mt-10 h-14 px-10 rounded-xl bg-sand-50 text-sand-900 text-[18px] font-semibold hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sand-50"
      >
        Dismiss
      </button>
    </div>
  );
}

/** One-tap start button for a duration detected in a step. Big + primary in Cook Mode. */
export function TimerButton({ timer, stepIndex, size = 'md' }) {
  const list = useTimers();
  const running = list.find((t) => t.stepIndex === stepIndex && t.total === timer.seconds && !t.done);
  if (running) {
    return (
      <span className={`inline-flex items-center gap-2 rounded-lg bg-sand-100 text-sand-600 ${size === 'lg' ? 'h-12 px-5 text-base' : 'h-11 px-4 text-[15px]'}`}>
        <TimerIcon className="w-4 h-4" /> Timer running
      </span>
    );
  }
  return (
    <button type="button" onClick={() => startTimer(timer.label, timer.seconds, stepIndex)} className={size === 'lg' ? 'btn-primary btn-lg' : 'btn-secondary'}>
      <TimerIcon className="w-4 h-4" />
      Start {timer.label} timer
    </button>
  );
}
