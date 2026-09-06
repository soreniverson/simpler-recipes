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
          25: 'rgb(var(--sand-25) / <alpha-value>)',
          50: 'rgb(var(--sand-50) / <alpha-value>)',
          100: 'rgb(var(--sand-100) / <alpha-value>)',
          200: 'rgb(var(--sand-200) / <alpha-value>)',
          300: 'rgb(var(--sand-300) / <alpha-value>)',
          400: 'rgb(var(--sand-400) / <alpha-value>)',
          500: 'rgb(var(--sand-500) / <alpha-value>)',
          600: 'rgb(var(--sand-600) / <alpha-value>)',
          700: 'rgb(var(--sand-700) / <alpha-value>)',
          800: 'rgb(var(--sand-800) / <alpha-value>)',
          900: 'rgb(var(--sand-900) / <alpha-value>)',
          950: 'rgb(var(--sand-950) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          light: 'rgb(var(--primary-light) / <alpha-value>)',
        },
        surface: 'rgb(var(--surface) / <alpha-value>)',
        background: 'rgb(var(--background) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        highlight: 'rgb(var(--highlight) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Geist', 'Geist Fallback', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"IBM Plex Serif"', 'Georgia', '"Times New Roman"', 'serif'],
        mono: ['"SF Mono"', 'SFMono-Regular', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
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
