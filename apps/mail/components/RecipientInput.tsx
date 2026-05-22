'use client'

import { useState, useRef } from 'react'
import { listContacts, type Contact } from '../lib/api'

export interface Recipient {
  email: string
  name?: string
}

interface RecipientInputProps {
  recipients: Recipient[]
  onChange: (recipients: Recipient[]) => void
  placeholder?: string
  disabled?: boolean
}

export function RecipientInput({ recipients, onChange, placeholder, disabled }: RecipientInputProps) {
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<Contact[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commit = (r: Recipient) => {
    onChange([...recipients, r])
    setText('')
    setSuggestions([])
    setOpen(false)
  }

  const handleChange = (val: string) => {
    setText(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const cs = await listContacts(val)
          setSuggestions(cs)
          setOpen(cs.length > 0)
        } catch {
          setSuggestions([])
        }
      }, 250)
    } else {
      setSuggestions([])
      setOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
      e.preventDefault()
      commit({ email: text.trim() })
    } else if (e.key === 'Backspace' && !text && recipients.length > 0) {
      onChange(recipients.slice(0, -1))
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (text.trim()) commit({ email: text.trim() })
      setOpen(false)
    }, 150)
  }

  return (
    <div className="relative flex flex-wrap gap-1 items-center min-h-[28px]">
      {recipients.map((r, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full"
        >
          {r.name ?? r.email}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(recipients.filter((_, j) => j !== i))}
              className="ml-0.5 hover:text-blue-600 text-blue-400 leading-none"
            >
              ×
            </button>
          )}
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={recipients.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] text-sm outline-none bg-transparent"
        disabled={disabled}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-64 mt-0.5 overflow-hidden">
          {suggestions.slice(0, 6).map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                commit({ email: c.email, name: c.name ?? undefined })
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
            >
              <div className="font-medium truncate">{c.name ?? c.email}</div>
              {c.name && <div className="text-xs text-gray-400 truncate">{c.email}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
