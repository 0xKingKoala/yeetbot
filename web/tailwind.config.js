/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'yeet-purple': '#8B5CF6',
        'yeet-pink': '#EC4899',
        'yeet-blue': '#3B82F6',
        'yeet-green': '#10B981',
        'yeet-red': '#EF4444',
        'yeet-yellow': '#F59E0B',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
