import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

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
      // Only crawlable, useful pages. Client-only shells and user-data pages are excluded.
      filter: (page) =>
        !/\/(auth|api|recipe|r|favorites|pantry|plan)\/?$/.test(page) &&
        !/\/(auth|api|r)\//.test(page),
      changefreq: 'weekly',
      lastmod: new Date(),
    }),
  ],
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
