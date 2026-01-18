/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sand: {
          25: 'var(--sand-25)',
          50: 'var(--sand-50)',
          100: 'var(--sand-100)',
          200: 'var(--sand-200)',
          300: 'var(--sand-300)',
          400: 'var(--sand-400)',
          500: 'var(--sand-500)',
          600: 'var(--sand-600)',
          700: 'var(--sand-700)',
          800: 'var(--sand-800)',
          900: 'var(--sand-900)',
          950: 'var(--sand-950)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
        },
        surface: 'var(--surface)',
        background: 'var(--background)',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'xs': '0 1px 2px 0 var(--shadow-color, rgba(58, 56, 50, 0.04))',
        'sm': '0 1px 2px 0 var(--shadow-color, rgba(58, 56, 50, 0.03)), 0 2px 4px 0 var(--shadow-color, rgba(58, 56, 50, 0.04))',
        'md': '0 6px 12px -2px var(--shadow-color, rgba(58, 56, 50, 0.02)), 0 12px 24px -4px var(--shadow-color, rgba(58, 56, 50, 0.03))',
        'lg': '0 8px 16px -4px var(--shadow-color, rgba(58, 56, 50, 0.02)), 0 16px 32px -8px var(--shadow-color, rgba(58, 56, 50, 0.03)), 0 24px 48px -12px var(--shadow-color, rgba(58, 56, 50, 0.02))',
      },
      letterSpacing: {
        'tight-headline': '-0.02em',
      },
    },
  },
  plugins: [],
}
