import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://simpler.recipes',
  output: 'static',
  adapter: vercel(),
  integrations: [
    react(),
    tailwind(),
  ],
  vite: {
    ssr: {
      noExternal: ['nanoid'],
    },
  },
});
