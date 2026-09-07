/**
 * Listing page -> candidate recipe URLs.
 *
 * Fetches a publisher's own category/collection page and pulls the recipe links out of
 * it, so every candidate provably exists. Nothing here decides quality; it only produces
 * URLs for the extract step to try.
 */
import { safeFetch } from '../../src/lib/safeFetch';
import { ruleFor } from './sites';

export async function discover(listingUrl: string, limit = 60): Promise<string[]> {
  const res = await safeFetch(listingUrl, { maxBytes: 4_000_000 });
  const base = new URL(res.url);
  const rule = ruleFor(base);
  if (!rule) throw new Error(`No site rule for ${base.hostname}`);

  const out = new Map<string, true>();
  // Hrefs from markup plus URLs embedded in JSON blobs (BBC/Allrecipes hydrate from JSON).
  const hrefs = [...res.body.matchAll(/href="([^"'\s>]+)"/gi)].map((m) => m[1]);
  const jsonUrls = [...res.body.matchAll(/"(https?:\\?\/\\?\/[^"\\]+?)"/gi)].map((m) => m[1].replace(/\\\//g, '/'));

  for (const raw of [...hrefs, ...jsonUrls]) {
    let u: URL;
    try { u = new URL(raw, base); } catch { continue; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
    if (!rule.host.test(u.hostname)) continue;
    u.hash = ''; u.search = '';
    if (!u.pathname.endsWith('/') && !/\.\w{2,4}$/.test(u.pathname)) u.pathname += '/';
    if (!rule.isRecipeUrl(u)) continue;
    out.set(u.toString(), true);
    if (out.size >= limit) break;
  }
  return [...out.keys()];
}

if (process.argv[2]) {
  discover(process.argv[2], Number(process.argv[3] || 60))
    .then((u) => { console.log(`${u.length} candidates from ${process.argv[2]}`); u.slice(0, 12).forEach((x) => console.log('  ' + x)); })
    .catch((e) => console.error('ERR', e.message));
}
