'use client'

import { useEffect, useRef, useState } from 'react'

const PRESETS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#ffffff',
  '#ff0000', '#cc0000', '#ff9900', '#ffff00', '#00cc00', '#00ff00',
  '#00ffff', '#00b0f0', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3',
  '#ead1dc', '#e6b8a2', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9',
]

interface ColorPickerProps {
  value?: string
  onChange: (color: string | undefined) => void
  label: string
  children: React.ReactNode
}

export function ColorPicker({ value, onChange, label, children }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
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
        onClick={() => setOpen(v => !v)}
        title={label}
        className={`flex flex-col items-center justify-center w-7 h-7 rounded transition-colors hover:bg-bg-hover ${open ? 'bg-bg-hover' : ''}`}
      >
        {children}
        <span
          className="block h-1 w-4 rounded-sm mt-0.5"
          style={{ backgroundColor: value ?? 'transparent', border: value ? 'none' : '1px dashed rgb(var(--border))' }}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 p-2.5 bg-bg-raised border border-border rounded-lg shadow-lg">
          <div className="grid grid-cols-6 gap-1 mb-2">
            {PRESETS.map(color => (
              <button
                key={color}
                onClick={() => { onChange(color); setOpen(false) }}
                title={color}
                className="w-5 h-5 rounded-sm transition-transform hover:scale-110 ring-offset-1"
                style={{
                  backgroundColor: color,
                  outline: value === color ? '2px solid rgb(var(--accent))' : '1px solid rgb(var(--border) / 0.4)',
                  outlineOffset: value === color ? '1px' : '0',
                }}
              />
            ))}
          </div>

          <div className="border-t border-border mt-1.5 pt-1.5 flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-fg-secondary cursor-pointer hover:text-fg-primary transition-colors">
              <input
                type="color"
                value={value && value !== 'transparent' ? value : '#000000'}
                onChange={e => onChange(e.target.value)}
                className="w-4 h-4 cursor-pointer rounded border-0 p-0 bg-transparent"
              />
              Custom
            </label>
            <button
              onClick={() => { onChange(undefined); setOpen(false) }}
              className="text-xs text-fg-tertiary hover:text-fg-primary px-1.5 py-0.5 rounded hover:bg-bg-hover transition-colors ml-auto"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
