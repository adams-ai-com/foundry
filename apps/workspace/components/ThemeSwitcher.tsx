'use client'

import { useTransition } from 'react'
import { setTheme } from '@/lib/actions'

type Theme = 'light' | 'dark' | 'warm'

const THEMES: { id: Theme; label: string; symbol: string }[] = [
  { id: 'light', label: 'Light', symbol: '○' },
  { id: 'dark',  label: 'Dark',  symbol: '●' },
  { id: 'warm',  label: 'Warm',  symbol: '◑' },
]

export function ThemeSwitcher({ current }: { current: Theme }) {
  const [, start] = useTransition()
  function select(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme)
    start(async () => { await setTheme(theme) })
  }
  return (
    <div role="group" aria-label="Theme" className="inline-flex items-center gap-0.5 bg-bg-surface border border-border rounded-lg p-0.5">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => select(t.id)}
          title={t.label}
          aria-pressed={current === t.id}
          className={`w-7 h-7 rounded flex items-center justify-center text-xs font-semibold transition-all duration-150 ${
            current === t.id
              ? 'bg-bg-raised shadow-sm text-fg-primary'
              : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-hover'
          }`}
        >
          {t.symbol}
        </button>
      ))}
    </div>
  )
}
