/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Olive green used for the main accent colour.
        brand: {
          50: '#f4f7ec',
          100: '#e7eed5',
          200: '#d0dfae',
          300: '#b3ca80',
          400: '#93ae53',
          500: '#739237',
          600: '#5a7828',
          700: '#46601f',
          800: '#394d1d',
          900: '#2f3f1b',
        },
      },
      fontFamily: {
        sans: [
          '"Instrument Sans"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        glass: '0 1px 2px rgba(60, 72, 30, 0.05), 0 12px 40px -14px rgba(60, 72, 30, 0.18)',
      },
    },
  },
  plugins: [],
}
