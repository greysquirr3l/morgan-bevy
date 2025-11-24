/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        editor: {
          bg: '#1e1e1e',
          panel: '#252526',
          border: '#3e3e42',
          accent: '#007acc',
          text: '#cccccc',
          textMuted: '#969696',
        },
        generation: {
          bsp: '#4ade80',
          wfc: '#f59e0b',
          manual: '#ef4444',
        }
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          /* Hide scrollbar for Chrome, Safari and Opera */
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          /* Hide scrollbar for IE, Edge and Firefox */
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
      })
    }
  ],
}