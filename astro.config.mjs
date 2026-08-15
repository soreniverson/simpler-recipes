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
    tailwind(),
    sitemap({
      // Only crawlable, useful pages. Client-only shells and user-data pages are excluded.
      filter: (page) =>
        !/\/(auth|api|recipe|r|favorites|pantry|plan)\/?$/.test(page) &&
        !/\/(auth|api|r)\//.test(page),
      changefreq: 'weekly',
      lastmod: new Date(),
    }),
  ],
  vite: {
    ssr: {
      noExternal: ['nanoid'],
    },
  },
});
