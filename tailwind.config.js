/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        boardBg: "#0b1329",
        cardBg: "rgba(30, 41, 59, 0.8)",
        boardGreen: "#0c3b2e",
        gold: "#eab308",
        'slate-850': '#151f32',
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      animation: {
        'bounce-short': 'bounce 0.5s ease-in-out 2',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(59, 130, 246, 0.6)' },
          '50%': { boxShadow: '0 0 25px rgba(59, 130, 246, 0.9)' },
        }
      }
    },
  },
  plugins: [],
}
