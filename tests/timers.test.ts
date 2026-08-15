import { describe, it, expect } from 'vitest';
import { detectTimers, formatCountdown } from '../src/lib/timers';

const secs = (t: string) => detectTimers(t).map((x) => x.seconds);
const labels = (t: string) => detectTimers(t).map((x) => x.label);

describe('detectTimers', () => {
  it('finds plain durations', () => {
    expect(secs('Bake for 20 minutes until golden.')).toEqual([1200]);
    expect(secs('Simmer 1 hour, stirring occasionally.')).toEqual([3600]);
    expect(secs('Chill for 1½ hours.')).toEqual([5400]);
    expect(secs('Rest 10 min before slicing.')).toEqual([600]);
    expect(secs('Cook 90 seconds per side.')).toEqual([90]);
    expect(labels('Bake 1 hour 30 minutes')).toEqual(['1 hr', '30 min']);
  });
  it('handles ranges with the lower bound and a range label', () => {
    expect(secs('Bake 8-10 minutes.')).toEqual([480]);
    expect(labels('Bake 8-10 minutes.')).toEqual(['8–10 min']);
    expect(labels('Roast for 1 to 1½ hours.')).toEqual(['1 hr–1 hr 30 min']);
    expect(secs('Cook 2 or 3 minutes.')).toEqual([120]);
  });
  it('handles number words', () => {
    expect(secs('Let stand for five minutes.')).toEqual([300]);
    expect(secs('Knead for a minute.')).toEqual([60]);
    expect(secs('rest for an hour')).toEqual([3600]);
  });
  it('ignores non-timers', () => {
    expect(secs('Preheat oven to 350 degrees.')).toEqual([]);
    expect(secs('Makes 20 cookies.')).toEqual([]);
    expect(secs('This 30-minute recipe is great.')).toEqual([]);
    expect(secs('Total time: 45 minutes')).toEqual([]);
    expect(secs('Add 2 cups flour and 3 eggs.')).toEqual([]);
    expect(secs('Wait 5 seconds.')).toEqual([]);
    expect(secs('')).toEqual([]);
  });
  it('dedupes and keeps multiple distinct timers', () => {
    expect(secs('Boil 10 minutes, then simmer 20 minutes, then another 10 minutes.')).toEqual([600, 1200]);
  });
});

describe('formatCountdown', () => {
  it('formats', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(3661)).toBe('1:01:01');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});
