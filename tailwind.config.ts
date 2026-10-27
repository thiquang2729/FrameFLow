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
        background: '#f8fafc',
        surface: {
          DEFAULT: '#ffffff',
          card: '#ffffff',
          subtle: '#f1f5f9',
          hover: '#f8fafc',
          active: '#e2e8f0'
        },
        border: {
          DEFAULT: '#e2e8f0',
          subtle: '#cbd5e1'
        },
        primary: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          subtle: '#eff6ff'
        }
      }
    }
  },
  plugins: []
} satisfies Config
