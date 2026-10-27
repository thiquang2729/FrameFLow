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
        background: '#0d1117',
        surface: {
          DEFAULT: '#161b22',
          subtle: '#21262d',
          hover: '#30363d'
        },
        border: {
          DEFAULT: '#30363d',
          subtle: '#21262d'
        },
        primary: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          light: '#3b82f6'
        },
        accent: {
          DEFAULT: '#3b82f6',
          purple: '#8b5cf6',
          teal: '#14b8a6'
        },
        status: {
          open: '#ef4444',
          fixed: '#10b981',
          partial: '#f59e0b',
          rejected: '#6b7280'
        }
      }
    }
  },
  plugins: []
} satisfies Config
