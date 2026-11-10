/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { 950: '#09140e', 900: '#102319', 800: '#183225', 700: '#214733', 600: '#315c40' },
        gold: { 300: '#f6d98b', 400: '#efc45c', 500: '#e0a73a', 600: '#c28a22' },
        paper: { 50: '#fbf8f1', 100: '#f4efe3', 200: '#e9e1cf' },
      },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { rise: 'rise .45s ease-out both', shimmer: 'shimmer 1.6s infinite' },
    },
  },
  plugins: [],
}
