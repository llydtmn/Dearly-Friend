/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: '#1a1a1a',
        paper: '#e8e4db',
        'paper-dark': '#d6d1c7',
        heart: '#8b2e2e',
        ink: '#2c2c2c',
        'ink-light': '#5a5a5a',
      },
      fontFamily: {
        handwriting: ['"Caveat"', 'cursive'],
        sans: ['"Inter"', 'sans-serif'],
      },
      backgroundImage: {
        'wood': "url('https://www.transparenttextures.com/patterns/wood-pattern.png')",
        'paper-texture': "url('https://www.transparenttextures.com/patterns/paper-fibers.png')",
      }
    },
  },
  plugins: [],
}
