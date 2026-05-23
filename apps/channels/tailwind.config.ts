import type { Config } from 'tailwindcss'

const v = (n: string) => `rgb(var(--${n}) / <alpha-value>)`

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base:    v('bg-base'),
          surface: v('bg-surface'),
          raised:  v('bg-raised'),
          hover:   v('bg-hover'),
          active:  v('bg-active'),
        },
        fg: {
          primary:   v('fg-primary'),
          secondary: v('fg-secondary'),
          tertiary:  v('fg-tertiary'),
        },
        border:  v('border'),
        accent: {
          DEFAULT: v('accent'),
          hover:   v('accent-h'),
          fg:      v('accent-fg'),
        },
        danger: v('danger'),
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
} satisfies Config
