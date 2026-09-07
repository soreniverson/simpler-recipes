/**
 * JSON-LD builders shared by every public page template. One place for the
 * escaping rule, the site identity, and the graph shapes — instead of six
 * hand-rolled JSON.stringify blocks drifting apart.
 *
 * House rules these builders enforce by construction:
 *  - undefined fields are dropped, never emitted as null/"" (no fabricated data);
 *  - output is `<`-escaped so a "</script>" inside any string can't break out;
 *  - breadcrumbs always start at the site root and number positions correctly.
 */

export const SITE = 'https://www.simpler.recipes';
export const SITE_NAME = 'Simpler Recipes';

export interface Crumb {
  name: string;
  /** Site-relative ('/browse/') or absolute; omit for the current page. */
  href?: string;
}

const abs = (href: string) => (href.startsWith('http') ? href : `${SITE}${href}`);

/** Strip undefined values so optional unknowns simply don't appear in the graph. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

/** BreadcrumbList mirroring the visible trail. `pageUrl` closes the trail. */
export function breadcrumbLd(crumbs: Crumb[], pageUrl: string): Record<string, unknown> {
  const items = [{ name: SITE_NAME, href: '/' }, ...crumbs];
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.href ? abs(c.href) : abs(pageUrl),
    })),
  };
}

export function collectionPageLd(opts: {
  url: string;
  name: string;
  description: string;
  items: { url: string; name: string; image?: string | null }[];
}): Record<string, unknown> {
  return {
    '@type': 'CollectionPage',
    '@id': abs(opts.url),
    url: abs(opts.url),
    name: opts.name,
    description: opts.description,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((r, i) =>
        // Images must be absolute in structured data; self-hosted photos are stored site-relative.
        compact({ '@type': 'ListItem', position: i + 1, url: abs(r.url), name: r.name, image: r.image ? abs(r.image) : undefined })
      ),
    },
  };
}

export function webPageLd(opts: { url: string; name: string; description: string }): Record<string, unknown> {
  return {
    '@type': 'WebPage',
    '@id': abs(opts.url),
    url: abs(opts.url),
    name: opts.name,
    description: opts.description,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/` },
  };
}

export function articleLd(opts: {
  url: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
}): Record<string, unknown> {
  const org = { '@type': 'Organization', name: SITE_NAME, url: `${SITE}/` };
  return {
    '@type': 'Article',
    '@id': `${abs(opts.url)}#article`,
    mainEntityOfPage: abs(opts.url),
    headline: opts.headline,
    description: opts.description,
    author: org,
    publisher: org,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
  };
}

/** Serialize a graph for a <script type="application/ld+json"> block. */
export function jsonLd(...graph: Record<string, unknown>[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}
