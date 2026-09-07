import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const header = readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');

/**
 * Regression guard for a bug that reached production: the desktop and mobile menu panels both
 * render whenever the menu is open (the mobile one is only hidden with `sm:hidden`), and both
 * were given the SAME ref. React assigns refs last-wins, so the ref pointed at the mobile panel
 * and the outside-click handler treated every desktop menu click as "outside" — mousedown closed
 * the menu and unmounted the item before its click could fire, so nothing in the menu worked.
 *
 * This is a source-level check because the behaviour only appears with a real mousedown+click
 * pair against both panels mounted, which needs a DOM testing stack the project doesn't carry.
 */
describe('Header menu refs', () => {
  it('never attaches the same ref to more than one element', () => {
    const counts = new Map<string, number>();
    for (const m of header.matchAll(/ref=\{(\w+)\}/g)) {
      counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1);
    expect(duplicated, `refs attached to multiple elements: ${duplicated.map(([r]) => r).join(', ')}`).toEqual([]);
  });

  it('the outside-click handler accounts for both menu panels', () => {
    const onDown = header.slice(header.indexOf('const onDown'), header.indexOf('const onKey'));
    expect(onDown, 'desktop panel must be treated as inside').toContain('menuRef');
    expect(onDown, 'mobile panel must be treated as inside').toContain('mobileMenuRef');
  });
});
