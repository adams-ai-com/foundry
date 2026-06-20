'use client'

import { useEffect, useRef, useState } from 'react'

export type BorderPreset = 'none' | 'all' | 'outer' | 'bottom' | 'top' | 'top-bottom'

interface BorderPickerProps {
  onApply: (preset: BorderPreset, color: string) => void
}

const PRESETS: { id: BorderPreset; label: string; icon: React.ReactNode }[] = [
  {
    id: 'none',
    label: 'No border',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1}>
        <rect x="2" y="2" width="12" height="12" strokeDasharray="2 2" strokeOpacity={0.4} />
      </svg>
    ),
  },
  {
    id: 'all',
    label: 'All borders',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="2" y="2" width="12" height="12" />
        <line x1="8" y1="2" x2="8" y2="14" />
        <line x1="2" y1="8" x2="14" y2="8" />
      </svg>
    ),
  },
  {
    id: 'outer',
    label: 'Outer box',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="2" y="2" width="12" height="12" />
      </svg>
    ),
  },
  {
    id: 'bottom',
    label: 'Bottom border',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor">
        <rect x="2" y="2" width="12" height="12" strokeWidth={0.5} strokeOpacity={0.3} />
        <line x1="2" y1="14" x2="14" y2="14" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: 'top',
    label: 'Top border',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor">
        <rect x="2" y="2" width="12" height="12" strokeWidth={0.5} strokeOpacity={0.3} />
        <line x1="2" y1="2" x2="14" y2="2" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: 'top-bottom',
    label: 'Top and bottom',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor">
        <rect x="2" y="2" width="12" height="12" strokeWidth={0.5} strokeOpacity={0.3} />
        <line x1="2" y1="2" x2="14" y2="2" strokeWidth={1.5} />
        <line x1="2" y1="14" x2="14" y2="14" strokeWidth={1.5} />
      </svg>
    ),
  },
]

export function BorderPicker({ onApply }: BorderPickerProps) {
  const [open, setOpen] = useState(false)
  const [color, setColor] = useState('#000000')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        title="Cell borders"
        onClick={() => setOpen(v => !v)}
        className={`flex flex-col items-center justify-center w-7 h-7 rounded transition-colors hover:bg-bg-hover ${open ? 'bg-bg-hover' : ''}`}
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-fg-secondary" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <rect x="2" y="2" width="12" height="12" />
          <line x1="8" y1="2" x2="8" y2="14" strokeWidth={0.75} strokeOpacity={0.5} />
          <line x1="2" y1="8" x2="14" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />
        </svg>
        <span className="block h-1 w-4 rounded-sm mt-0.5" style={{ backgroundColor: color }} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-bg-raised border border-border rounded-lg shadow-lg">
          <div className="grid grid-cols-3 gap-1 mb-2">
            {PRESETS.map(p => (
              <button
                key={p.id}
                title={p.label}
                onClick={() => { onApply(p.id, color); setOpen(false) }}
                className="flex items-center justify-center w-8 h-8 rounded hover:bg-bg-hover transition-colors text-fg-primary"
              >
                {p.icon}
              </button>
            ))}
          </div>
          <div className="border-t border-border pt-2 flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-fg-secondary cursor-pointer">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-4 h-4 cursor-pointer border-0 p-0 bg-transparent rounded"
              />
              Color
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
