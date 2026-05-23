'use client'

import { useEffect, useRef, useState } from 'react'
import type { SessionUser } from '@foundry/auth'

type Message = {
  id: string; author_id: string; author_name: string; author_email: string
  body: string; reactions: unknown[]; edited_at: string | null; created_at: string
}

interface Props {
  orgSlug:      string
  session:      SessionUser
  channelId:    string
  channelName:  string
  topicId:      string
  topicName:    string | null
  messages:     Message[]
  onNewMessage: (msg: Message) => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const diff = today.getDate() - d.getDate()
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

export function MessagePanel({ orgSlug, session, channelId, channelName, topicId, topicName, messages, onNewMessage }: Props) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!body.trim() || sending || topicId === '_new') return
    setSending(true)
    setError('')
    try {
      const res = await fetch(`/api/channels/${channelId}/topics/${topicId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })
      if (!res.ok) { setError('Failed to send. Try again.'); return }
      const msg = await res.json() as Message
      onNewMessage(msg)
      setBody('')
      textareaRef.current?.focus()
    } finally { setSending(false) }
  }

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const date = formatDate(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === date) last.messages.push(msg)
    else grouped.push({ date, messages: [msg] })
  }

  const initials = (name: string) => name.slice(0, 2).toUpperCase()

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center px-4 gap-2 shrink-0 bg-bg-base">
        <span className="text-fg-tertiary font-medium">#</span>
        <span className="font-semibold text-fg-primary text-sm">{channelName}</span>
        {topicName && (
          <>
            <span className="text-fg-tertiary mx-1">›</span>
            <span className="text-fg-secondary text-sm">{topicName}</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {topicId === '_new' ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-bg-surface border border-border flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-fg-tertiary">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
            </div>
            <p className="text-fg-secondary text-sm">No topics yet in <strong className="text-fg-primary">#{channelName}</strong></p>
            <p className="text-fg-tertiary text-xs mt-1">Use the sidebar to create a new topic.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-bg-surface border border-border flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-fg-tertiary">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
            </div>
            <p className="text-fg-primary text-sm font-medium">{topicName}</p>
            <p className="text-fg-tertiary text-xs mt-1">No messages yet. Be the first to say something.</p>
          </div>
        ) : (
          <>
            {grouped.map(({ date, messages: msgs }) => (
              <div key={date}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] font-medium text-fg-tertiary">{date}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {msgs.map((msg, i) => {
                  const prev = i > 0 ? msgs[i - 1] : null
                  const grouped = prev?.author_id === msg.author_id &&
                    new Date(msg.created_at).getTime() - new Date(prev!.created_at).getTime() < 5 * 60_000

                  return (
                    <div key={msg.id} className={`flex gap-3 group hover:bg-bg-surface rounded px-1 ${grouped ? 'mt-0.5' : 'mt-3'}`}>
                      {grouped ? (
                        <div className="w-8 shrink-0 flex items-start justify-end pt-0.5">
                          <span className="text-[10px] text-fg-tertiary opacity-0 group-hover:opacity-100 transition-opacity leading-none mt-1">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      ) : (
                        <div className="w-8 h-8 shrink-0 bg-accent/15 rounded-full flex items-center justify-center mt-0.5">
                          <span className="text-accent text-xs font-semibold">{initials(msg.author_name)}</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {!grouped && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-fg-primary">{msg.author_name}</span>
                            <span className="text-[11px] text-fg-tertiary">{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                        <p className="text-sm text-fg-primary leading-relaxed break-words whitespace-pre-wrap">{msg.body}</p>
                        {msg.edited_at && (
                          <span className="text-[10px] text-fg-tertiary">(edited)</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Compose */}
      {topicId !== '_new' && (
        <div className="shrink-0 px-4 pb-4">
          {error && <p className="text-danger text-xs mb-1">{error}</p>}
          <div className="flex items-end gap-2 bg-bg-surface border border-border rounded-xl px-3 py-2 focus-within:border-accent/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={e => { setBody(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px` }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder={topicName ? `Message ${topicName}` : 'Message…'}
              rows={1}
              className="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-tertiary resize-none focus:outline-none leading-relaxed min-h-[24px]"
              style={{ height: 24 }}
            />
            <button
              onClick={send}
              disabled={!body.trim() || sending}
              className="shrink-0 w-8 h-8 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
              title="Send (Enter)"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-accent-fg">
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z"/>
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-fg-tertiary mt-1.5 ml-1">
            <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift+Enter</kbd> for new line
          </p>
        </div>
      )}
    </div>
  )
}
