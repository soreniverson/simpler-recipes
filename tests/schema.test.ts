import { describe, it, expect } from 'vitest';
import { jsonLd, breadcrumbLd, collectionPageLd, articleLd, webPageLd, SITE } from '../src/lib/schema';

describe('schema builders', () => {
  it('escapes script-closing sequences so JSON-LD cannot break out of its tag', () => {
    const out = jsonLd(webPageLd({ url: '/x/', name: 'Sneaky </script><script>alert(1)</script>', description: 'd' }));
    expect(out).not.toContain('</script>');
    expect(JSON.parse(out.replace(/\\u003c/g, '<'))['@graph'][0].name).toContain('</script>');
  });

  it('breadcrumbs start at the site root, number positions, and close at the page', () => {
    const b = breadcrumbLd([{ name: 'Browse', href: '/browse/' }, { name: 'Chicken' }], `${SITE}/browse/chicken/`) as any;
    expect(b.itemListElement.map((i: any) => [i.position, i.name, i.item])).toEqual([
      [1, 'Simpler Recipes', `${SITE}/`],
      [2, 'Browse', `${SITE}/browse/`],
      [3, 'Chicken', `${SITE}/browse/chicken/`],
    ]);
  });

  it('collection items omit missing images instead of emitting null', () => {
    const c = collectionPageLd({ url: '/browse/x/', name: 'X', description: 'd', items: [{ url: '/recipes/a/', name: 'A', image: null }] }) as any;
    expect('image' in c.mainEntity.itemListElement[0]).toBe(false);
    expect(c.mainEntity.numberOfItems).toBe(1);
    expect(c.mainEntity.itemListElement[0].url).toBe(`${SITE}/recipes/a/`);
  });

  it('article carries real dates and org identity, nothing invented', () => {
    const a = articleLd({ url: '/p/', headline: 'H', description: 'd', datePublished: '2026-09-06', dateModified: '2026-09-07' }) as any;
    expect(a.datePublished).toBe('2026-09-06');
    expect(a.author.name).toBe('Simpler Recipes');
    expect(a.aggregateRating).toBeUndefined();
  });
});
