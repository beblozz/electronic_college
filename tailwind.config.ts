import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#FFFFFF',
        subtle: '#F5F5F5',
        line: '#E5E5E5',
        muted: '#737373',
        ink: '#171717',
        accent: '#2563EB',
        danger: '#DC2626',
        loadLow: '#DCFCE7',
        loadMedium: '#FEF3C7',
        loadHigh: '#FEE2E2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        caption: ['12px', '16px'],
        body: ['14px', '20px'],
        title: ['18px', '24px'],
      },
      borderRadius: {
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        popover: '0 4px 12px rgba(0, 0, 0, 0.08)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
}

export default config
