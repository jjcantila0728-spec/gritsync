/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
      animation: {
        'blob': 'blob 7s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.8s ease-out forwards',
        'bounce-x': 'bounce-x 1.5s ease-in-out infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
        'gradient': 'gradient 3s ease infinite',
      },
    },
  },
  plugins: [],
}

