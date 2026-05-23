'use client'

import { useState } from 'react'

type Summary = {
  bullets: string[]
  action_items: string[]
  generated_at: string
}

interface Props {
  channelId: string
  topicId: string
  existingSummary: Summary | null
}

export function TopicSummary({ channelId, topicId, existingSummary }: Props) {
  const [summary, setSummary] = useState<Summary | null>(existingSummary)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/channels/${channelId}/topics/${topicId}/summary`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json() as { error: string }
        setError(data.error ?? 'Failed to generate summary')
        return
      }
      setSummary(await res.json() as Summary)
      setOpen(true)
    } finally { setLoading(false) }
  }

  return (
    <div className="relative">
      <button
        onClick={() => { if (summary) setOpen(v => !v); else generate() }}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border text-fg-tertiary hover:text-fg-secondary hover:border-border-hover transition-colors disabled:opacity-50"
        title="AI topic summary"
      >
        {loading ? (
          <div className="w-3 h-3 border border-fg-tertiary border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M8 1.5a.75.75 0 01.75.75v.757A4.5 4.5 0 0112.5 7.5h.75a.75.75 0 010 1.5h-.75A4.5 4.5 0 018.75 13v.75a.75.75 0 01-1.5 0V13A4.5 4.5 0 013.5 9H2.75a.75.75 0 010-1.5H3.5A4.5 4.5 0 017.25 3v-.75A.75.75 0 018 1.5zm0 4a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/>
          </svg>
        )}
        {summary ? (open ? 'Hide summary' : 'Show summary') : 'Summarize'}
      </button>

      {error && <p className="absolute right-0 top-full mt-1 text-xs text-danger bg-bg-raised border border-border rounded-lg px-2 py-1 z-10 whitespace-nowrap">{error}</p>}

      {open && summary && (
        <div className="mt-2 bg-accent/5 border border-accent/20 rounded-xl p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">AI Summary</span>
            <button
              onClick={generate}
              disabled={loading}
              className="text-[10px] text-fg-tertiary hover:text-fg-secondary disabled:opacity-50"
            >
              Regenerate
            </button>
          </div>
          <ul className="space-y-1.5 mb-3">
            {summary.bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-fg-secondary">
                <span className="text-accent shrink-0 mt-0.5">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {summary.action_items.length > 0 && (
            <>
              <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-wider mb-1.5">Action Items</p>
              <ul className="space-y-1">
                {summary.action_items.map((a, i) => (
                  <li key={i} className="flex gap-2 text-fg-secondary">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5">
                      <path d="M2.5 3.5A1.5 1.5 0 014 2h8a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0112 14H4a1.5 1.5 0 01-1.5-1.5v-9zm9 0H4v9h8v-9zM6.5 6a.5.5 0 01.5-.5h2.5a.5.5 0 010 1H7a.5.5 0 01-.5-.5zm0 2.5a.5.5 0 01.5-.5h2.5a.5.5 0 010 1H7a.5.5 0 01-.5-.5z"/>
                    </svg>
                    <span className="text-xs">{a}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-[10px] text-fg-tertiary mt-3">
            Generated {new Date(summary.generated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  )
}
