/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1a1a24',
          card: '#22222e',
          overlay: '#2a2a38',
        },
        brand: { DEFAULT: '#6366f1', dark: '#4f46e5' },
        income: '#22c55e',
        expense: '#ef4444',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
