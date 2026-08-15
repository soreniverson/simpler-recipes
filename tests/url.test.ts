import { describe, it, expect } from 'vitest';
import { normalizeUrl, cacheKeyForUrl, looksLikeUrl } from '../src/lib/url';

const ok = (s: string) => {
  const r = normalizeUrl(s);
  if (!r.ok) throw new Error(`expected ok for ${s}, got ${r.error}`);
  return r.url;
};

describe('normalizeUrl', () => {
  it('adds https to scheme-less input', () => {
    expect(ok('allrecipes.com/recipe/23600/')).toBe('https://allrecipes.com/recipe/23600/');
    expect(ok('www.recipetineats.com/chicken-tikka-masala/')).toBe('https://www.recipetineats.com/chicken-tikka-masala/');
    expect(ok('//example.com/x')).toBe('https://example.com/x');
  });

  it('trims whitespace and surrounding punctuation from pasted text', () => {
    expect(ok('  https://example.com/recipe  ')).toBe('https://example.com/recipe');
    expect(ok('<https://example.com/recipe>')).toBe('https://example.com/recipe');
    expect(ok('"https://example.com/recipe".')).toBe('https://example.com/recipe');
    expect(ok('https://example.com/rec\nipe')).toBe('https://example.com/recipe');
  });

  it('strips fragments', () => {
    expect(ok('https://example.com/recipe#recipe')).toBe('https://example.com/recipe');
    expect(ok('https://example.com/recipe/#comments')).toBe('https://example.com/recipe/');
  });

  it('removes tracking params but keeps meaningful ones', () => {
    expect(ok('https://example.com/r?utm_source=x&utm_medium=y&id=42&fbclid=abc')).toBe('https://example.com/r?id=42');
    expect(ok('https://example.com/r?gclid=1&p=2')).toBe('https://example.com/r?p=2');
    expect(ok('https://example.com/r?ref=pinterest')).toBe('https://example.com/r');
    expect(ok('https://example.com/r?recipe_id=9')).toBe('https://example.com/r?recipe_id=9');
    expect(ok('https://example.com/r?UTM_SOURCE=x')).toBe('https://example.com/r');
  });

  it('removes AMP variants', () => {
    expect(ok('https://example.com/recipe/amp/')).toBe('https://example.com/recipe/');
    expect(ok('https://example.com/recipe/amp')).toBe('https://example.com/recipe/');
    expect(ok('https://example.com/recipe?amp=1')).toBe('https://example.com/recipe');
    expect(ok('https://example.com/amp/recipe')).toBe('https://example.com/recipe');
  });

  it('lowercases host, drops default port, keeps path case', () => {
    expect(ok('HTTPS://Example.COM:443/Recipe/Foo')).toBe('https://example.com/Recipe/Foo');
    expect(ok('http://example.com:80/x')).toBe('http://example.com/x');
    expect(ok('https://example.com:8443/x')).toBe('https://example.com:8443/x');
  });

  it('collapses duplicate slashes', () => {
    expect(ok('https://example.com//recipes///x')).toBe('https://example.com/recipes/x');
  });

  it('rejects garbage', () => {
    expect(normalizeUrl('')).toEqual({ ok: false, error: 'empty' });
    expect(normalizeUrl('   ')).toEqual({ ok: false, error: 'empty' });
    expect(normalizeUrl('chicken')).toEqual({ ok: false, error: 'invalid-host' });
    expect(normalizeUrl('not a url')).toEqual({ ok: false, error: 'invalid-host' });
    expect(normalizeUrl(null)).toEqual({ ok: false, error: 'invalid' });
    expect(normalizeUrl(42)).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects unsupported schemes', () => {
    expect(normalizeUrl('file:///etc/passwd')).toEqual({ ok: false, error: 'unsupported-scheme' });
    expect(normalizeUrl('ftp://example.com/x')).toEqual({ ok: false, error: 'unsupported-scheme' });
    expect(normalizeUrl('javascript:alert(1)')).toEqual({ ok: false, error: 'unsupported-scheme' });
    expect(normalizeUrl('data:text/html,hi')).toEqual({ ok: false, error: 'unsupported-scheme' });
    expect(normalizeUrl('gopher://x.com')).toEqual({ ok: false, error: 'unsupported-scheme' });
  });

  it('rejects credentials in URL', () => {
    expect(normalizeUrl('https://user:pass@example.com/')).toEqual({ ok: false, error: 'invalid' });
  });

  it('keeps unicode paths', () => {
    expect(ok('https://example.com/récipe')).toBe('https://example.com/r%C3%A9cipe');
  });
});

describe('cacheKeyForUrl', () => {
  it('collapses variants of the same page', () => {
    const variants = [
      'https://www.example.com/recipes/pasta/',
      'https://example.com/recipes/pasta',
      'http://www.example.com/recipes/pasta/?utm_source=x',
      'https://WWW.EXAMPLE.COM/recipes/pasta/#ingredients',
      'https://www.example.com/recipes/pasta/amp/',
    ];
    const keys = new Set(variants.map(cacheKeyForUrl));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe('example.com/recipes/pasta');
  });

  it('distinguishes different pages and sorts params', () => {
    expect(cacheKeyForUrl('https://x.com/r?b=2&a=1')).toBe('x.com/r?a=1&b=2');
    expect(cacheKeyForUrl('https://x.com/r?a=1')).not.toBe(cacheKeyForUrl('https://x.com/r?a=2'));
  });
});

describe('looksLikeUrl', () => {
  it('detects urls', () => {
    expect(looksLikeUrl('https://x.com')).toBe(true);
    expect(looksLikeUrl('www.x.com')).toBe(true);
    expect(looksLikeUrl('allrecipes.com/recipe/1')).toBe(true);
    expect(looksLikeUrl('smittenkitchen.com')).toBe(true);
  });
  it('rejects search queries', () => {
    expect(looksLikeUrl('chicken tikka')).toBe(false);
    expect(looksLikeUrl('pasta')).toBe(false);
    expect(looksLikeUrl('e.g. cookies')).toBe(false);
    expect(looksLikeUrl('')).toBe(false);
  });
});

import { safeImageSrc } from '../src/lib/recipe/href';
describe('safeImageSrc', () => {
  it('accepts http(s) and root-relative paths only', () => {
    expect(safeImageSrc('https://a.com/x.jpg')).toBe('https://a.com/x.jpg');
    expect(safeImageSrc('/_astro/x.webp')).toBe('/_astro/x.webp');
    expect(safeImageSrc('//evil.com/x.jpg')).toBeNull();
    expect(safeImageSrc('javascript:alert(1)')).toBeNull();
    expect(safeImageSrc('data:image/png;base64,AAAA')).toBeNull();
    expect(safeImageSrc(null)).toBeNull();
  });
});

describe('normalizeUrl host:port', () => {
  it('treats a dotted host with a port as a host, not a scheme', () => {
    const r = normalizeUrl('example.com:8080/x');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toBe('https://example.com:8080/x');
    expect(normalizeUrl('mailto:someone@example.com').ok).toBe(false);
  });
});
