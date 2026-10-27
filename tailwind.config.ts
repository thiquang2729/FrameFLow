import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0c1017',
        surface: {
          DEFAULT: '#131923',
          card: '#131923',
          subtle: '#0e141f',
          hover: '#18202f',
          active: '#1a2538'
        },
        border: {
          DEFAULT: '#1f293d',
          subtle: '#172030'
        },
        primary: {
          DEFAULT: '#1d6bf3',
          hover: '#185cd4',
          subtle: '#132a4a'
        },
        accent: {
          blue: '#3b82f6',
          purple: '#8b5cf6',
          emerald: '#10b981',
          coral: '#f43f5e'
        }
      }
    }
  },
  plugins: []
} satisfies Config
