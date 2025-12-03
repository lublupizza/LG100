/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        pizza: {
          red: '#DC2626',
          dark: '#991B1B',
          bg: '#F9FAFB',
        },
        gray: {
          750: '#2d3748',
        }
      }
    },
  },
  plugins: [],
}
