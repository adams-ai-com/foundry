'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────

type Source = {
  index:        number
  source_type:  'message' | 'transcript'
  source_id:    string
  channel_id:   string | null
  topic_id:     string | null
  channel_name: string | null
  topic_name:   string | null
  author_name:  string | null
  call_title:   string | null
  call_id:      string | null
  date:         string
  excerpt:      string
  score:        number
}

type TimelineCall = {
  type: 'call'
  id: string; title: string; channel_id: string | null; topic_id: string | null
  channel_name: string | null; topic_name: string | null
  duration_minutes: number; ai_summary: string | null; at: string
}

type TimelineMessages = {
  type: 'messages'
  channel_id: string; topic_id: string
  channel_name: string; topic_name: string
  message_count: number; participants: string[]; at: string
}

type TimelineItem = TimelineCall | TimelineMessages
type TimelineDay  = { date: string; items: TimelineItem[] }

interface Props {
  orgSlug:  string
  onClose:  () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmtDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff  = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Replace [N] citation markers with styled spans
function renderAnswer(text: string, sources: Source[], orgSlug: string): React.ReactNode {
  const parts = text.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/)
    if (!m) return part
    const idx = parseInt(m[1])
    const src = sources.find(s => s.index === idx)
    if (!src) return <span key={i} className="text-accent">{part}</span>

    const href = src.source_type === 'message' && src.channel_id && src.topic_id
      ? `/org/${orgSlug}/${src.channel_id}/${src.topic_id}`
      : src.source_type === 'transcript' && src.channel_id && src.topic_id
        ? `/org/${orgSlug}/${src.channel_id}/${src.topic_id}`
        : null

    return href
      ? <a key={i} href={href} className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-accent/15 text-accent rounded hover:bg-accent/25 transition-colors align-middle mx-0.5">{idx}</a>
      : <span key={i} className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-accent/15 text-accent rounded align-middle mx-0.5">{idx}</span>
  })
}

// ─── Ask AI tab ───────────────────────────────────────────────────────────

function AskTab({ orgSlug }: { orgSlug: string }) {
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(false)
  const [answer,  setAnswer]  = useState<string | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [note,    setNote]    = useState<string | null>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function ask() {
    if (!query.trim() || loading) return
    setLoading(true)
    setAnswer(null)
    setSources([])
    setNote(null)
    try {
      const res = await fetch('/api/channels/memory/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const d = await res.json() as { answer?: string | null; sources?: Source[]; note?: string; error?: string }
      if (d.answer !== undefined) setAnswer(d.answer)
      if (d.sources) setSources(d.sources)
      if (d.note) setNote(d.note)
      if (d.error) setNote(d.error)
    } catch {
      setNote('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Input */}
      <div className="px-4 pt-3 pb-3 border-b border-border">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
            placeholder="What did we decide about…"
            rows={2}
            className="w-full bg-bg-raised border border-border rounded-xl px-3 py-2.5 pr-10 text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-accent resize-none"
          />
          <button
            onClick={ask}
            disabled={!query.trim() || loading}
            className="absolute right-2.5 bottom-2.5 w-7 h-7 bg-accent disabled:opacity-30 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
          >
            {loading
              ? <span className="w-3 h-3 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
              : <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-accent-fg">
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z"/>
                </svg>
            }
          </button>
        </div>
        <p className="text-[10px] text-fg-muted mt-1.5">Ask anything about your team's messages and calls</p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {note && !answer && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-fg-muted">{note}</p>
          </div>
        )}

        {answer && (
          <div className="px-4 pt-4 pb-2">
            <div className="text-sm text-fg-primary leading-relaxed whitespace-pre-wrap">
              {renderAnswer(answer, sources, orgSlug)}
            </div>
          </div>
        )}

        {sources.length > 0 && (
          <div className="px-4 pt-2 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-fg-muted font-medium mb-2">Sources</p>
            <div className="space-y-2">
              {sources.map(src => {
                const href = src.channel_id && src.topic_id
                  ? `/org/${orgSlug}/${src.channel_id}/${src.topic_id}`
                  : null
                const label = src.source_type === 'message'
                  ? `#${src.channel_name} · ${src.topic_name}`
                  : `📞 ${src.call_title}`
                const meta = src.source_type === 'message'
                  ? `${src.author_name} · ${src.date}`
                  : src.date

                return (
                  <div key={src.source_id} className="flex gap-2.5 text-xs group">
                    <span className="w-5 h-5 shrink-0 flex items-center justify-center bg-bg-raised border border-border rounded text-[10px] font-bold text-accent mt-0.5">
                      {src.index}
                    </span>
                    <div className="flex-1 min-w-0">
                      {href
                        ? <a href={href} className="font-medium text-fg-primary hover:text-accent transition-colors truncate block">{label}</a>
                        : <span className="font-medium text-fg-primary truncate block">{label}</span>
                      }
                      <p className="text-fg-muted text-[10px] mt-0.5">{meta}</p>
                      <p className="text-fg-secondary mt-1 leading-relaxed line-clamp-2">{src.excerpt}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!answer && !note && !loading && (
          <div className="px-4 py-8 text-center">
            <div className="w-10 h-10 bg-bg-raised rounded-full flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-fg-muted">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
              </svg>
            </div>
            <p className="text-xs text-fg-muted">Ask a question and get an AI-powered answer<br/>sourced from your team's messages and calls.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Timeline tab ─────────────────────────────────────────────────────────

function TimelineTab({ orgSlug }: { orgSlug: string }) {
  const [timeline, setTimeline] = useState<TimelineDay[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/channels/timeline?days=30')
      if (res.ok) {
        const d = await res.json() as { timeline: TimelineDay[] }
        setTimeline(d.timeline)
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 text-center">
        <p className="text-xs text-fg-muted">No activity in the last 30 days.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
      {timeline.map(day => (
        <div key={day.date}>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted font-medium mb-2 sticky top-0 bg-bg-base py-1">
            {fmtDay(day.date)}
          </p>
          <div className="space-y-2">
            {day.items.map((item, idx) => {
              if (item.type === 'call') {
                const href = item.channel_id && item.topic_id
                  ? `/org/${orgSlug}/${item.channel_id}/${item.topic_id}`
                  : null
                const dur = item.duration_minutes > 0 ? `${item.duration_minutes} min` : null
                const summaryLines = item.ai_summary?.split('\n').filter(Boolean).slice(0, 2) ?? []
                return (
                  <div key={idx} className="flex gap-2.5 text-xs">
                    <span className="text-base mt-0.5 shrink-0">📞</span>
                    <div className="flex-1 min-w-0">
                      {href
                        ? <a href={href} className="font-medium text-fg-primary hover:text-accent transition-colors">{item.title}</a>
                        : <span className="font-medium text-fg-primary">{item.title}</span>
                      }
                      {dur && <span className="text-fg-muted ml-1.5">· {dur}</span>}
                      {summaryLines.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {summaryLines.map((line, li) => (
                            <p key={li} className="text-fg-secondary text-[11px] leading-relaxed line-clamp-1">
                              {line.replace(/^[•·\-]\s*/, '')}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              // messages group
              const href = `/org/${orgSlug}/${item.channel_id}/${item.topic_id}`
              const who  = item.participants.join(', ') + (item.participants.length >= 4 ? '…' : '')
              return (
                <div key={idx} className="flex gap-2.5 text-xs">
                  <span className="text-base mt-0.5 shrink-0">💬</span>
                  <div className="flex-1 min-w-0">
                    <a href={href} className="font-medium text-fg-primary hover:text-accent transition-colors">
                      #{item.channel_name} · {item.topic_name}
                    </a>
                    <p className="text-fg-muted text-[11px] mt-0.5">
                      {item.message_count} message{item.message_count !== 1 ? 's' : ''}
                      {who ? ` · ${who}` : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main MemoryPanel ─────────────────────────────────────────────────────

export function MemoryPanel({ orgSlug, onClose }: Props) {
  const [tab, setTab] = useState<'ask' | 'timeline'>('ask')

  return (
    <div className="flex flex-col flex-1 bg-bg-base border-l border-border overflow-hidden">
      {/* Header */}
      <div className="shrink-0 h-12 flex items-center px-4 gap-3 border-b border-border">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-accent shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
        </svg>
        <span className="text-sm font-semibold text-fg-primary flex-1">Workspace Memory</span>
        <button onClick={onClose} className="text-fg-muted hover:text-fg-primary transition-colors p-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-border px-4">
        {(['ask', 'timeline'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-fg-muted hover:text-fg-primary'
            }`}
          >
            {t === 'ask' ? 'Ask AI' : 'Timeline'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'ask'      ? <AskTab      orgSlug={orgSlug} /> : null}
      {tab === 'timeline' ? <TimelineTab orgSlug={orgSlug} /> : null}
    </div>
  )
}
