/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          25: '#fdfcfb',
          50: '#fbfaf8',
          100: '#f8f7f4',
          200: '#efede8',
          300: '#e7e4dc',
          400: '#d8d5ca',
          500: '#bfbaad',
          600: '#9a9484',
          700: '#6e6c63',
          800: '#504e47',
          900: '#3a3832',
          950: '#1a1a18',
        },
        primary: {
          DEFAULT: '#1a1a18',
          light: '#3a3832',
        },
        surface: '#fbfaf8',
        background: '#f8f7f4',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(58, 56, 50, 0.04)',
        'sm': '0 1px 2px 0 rgba(58, 56, 50, 0.03), 0 2px 4px 0 rgba(58, 56, 50, 0.04)',
        'md': '0 6px 12px -2px rgba(58, 56, 50, 0.02), 0 12px 24px -4px rgba(58, 56, 50, 0.03)',
        'lg': '0 8px 16px -4px rgba(58, 56, 50, 0.02), 0 16px 32px -8px rgba(58, 56, 50, 0.03), 0 24px 48px -12px rgba(58, 56, 50, 0.02)',
      },
      letterSpacing: {
        'tight-headline': '-0.02em',
      },
    },
  },
  plugins: [],
}
