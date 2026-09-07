import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import fs from 'node:fs';
import { buildBrowsePages } from './src/lib/browse';
import { SEARCH_PAGES } from './src/lib/searchPages';

// Honest per-URL lastmod for the sitemap: recipe pages use the recipe's real addedDate,
// collection pages use max(page published, newest member recipe), hand-written pages use
// their registry's `updated`. Never the build timestamp — a crawler that trusts lastmod
// should be told the truth.
const catalog = JSON.parse(fs.readFileSync(new URL('./recipe-data/all-recipes.json', import.meta.url), 'utf-8'));
const recipeDates = new Map(catalog.recipes.map((r) => [r.slug, r.addedDate]));
const browsePages = buildBrowsePages(catalog.recipes);
const browseDates = new Map(
  browsePages.map((p) => {
    const newest = p.recipes.map((r) => recipeDates.get(r.slug) || '').sort().at(-1) || '';
    return [p.slug, [p.published, newest].sort().at(-1)];
  })
);
const collectionDates = new Map(
  catalog.collections.map((c) => [c.slug, c.recipes.map((s) => recipeDates.get(s) || '').sort().at(-1)])
);
const searchPageDates = new Map(SEARCH_PAGES.map((p) => [p.path, p.updated]));

function lastmodFor(pathname) {
  let m = pathname.match(/^\/recipes\/([^/]+)\/$/);
  if (m) return recipeDates.get(m[1]);
  m = pathname.match(/^\/browse\/([^/]+)\/$/);
  if (m) return browseDates.get(m[1]);
  m = pathname.match(/^\/collection\/([^/]+)\/$/);
  if (m) return collectionDates.get(m[1]);
  return searchPageDates.get(pathname);
}

export default defineConfig({
  site: 'https://www.simpler.recipes',
  output: 'static',
  adapter: vercel(),
  integrations: [
    react(),
    // Base styles live in BaseLayout's global <style>; letting the integration inject them too
    // compiled Tailwind twice (~57KB of CSS on every page).
    tailwind({ applyBaseStyles: false }),
    sitemap({
      // Only crawlable, useful pages. Client-only shells (/recipe, /shared) and
      // user-data pages are excluded; /r/* and /shared are noindex as well.
      filter: (page) =>
        !/\/(auth|api|recipe|shared|r|favorites|pantry|plan)\/?$/.test(page) &&
        !/\/(auth|api|r)\//.test(page),
      serialize(item) {
        const pathname = new URL(item.url).pathname;
        const date = lastmodFor(pathname);
        // Pages without a known content date get no lastmod rather than a fake one.
        // Dates arrive as YYYY-MM-DD (registry) or full ISO (catalog addedDate): emit day precision.
        const { lastmod, ...rest } = item;
        return date ? { ...rest, lastmod: String(date).slice(0, 10) } : rest;
      },
      changefreq: 'weekly',
    }),
  ],
  image: {
    // Curated recipe photos live on the publishers' CDNs; we optimize them at build time.
    remotePatterns: [{ protocol: 'https' }],
  },
  build: {
    // The whole stylesheet is small; inlining removes a render-blocking request.
    inlineStylesheets: 'always',
  },
  vite: {
    ssr: {
      noExternal: ['nanoid'],
    },
  },
});
