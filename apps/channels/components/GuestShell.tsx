'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Reaction = { emoji: string; user_ids: string[] }
type Message = {
  id: string; author_id: string; author_name: string; author_email: string
  body: string; reactions: Reaction[]; edited_at: string | null; created_at: string; is_guest: boolean
}

interface Props {
  guestId: string
  guestName: string
  guestEmail: string
  channelId: string
  topicId: string
  channelName: string
  topicName: string
  initialMessages: Message[]
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

function initials(name: string) { return name.slice(0, 2).toUpperCase() }

export function GuestShell({
  guestId, guestName, guestEmail,
  channelId, topicId, channelName, topicName, initialMessages,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const es = new EventSource('/api/sse')
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data as string) as {
          type: string; channelId: string; topicId?: string; message?: Message
        }
        if (ev.type === 'message:new' && ev.message &&
            ev.channelId === channelId && ev.topicId === topicId) {
          setMessages(prev =>
            prev.some(m => m.id === ev.message!.id) ? prev : [...prev, ev.message!]
          )
        }
      } catch {}
    }
    return () => es.close()
  }, [channelId, topicId])

  async function send() {
    if (!body.trim() || sending) return
    setSending(true); setError('')
    try {
      const res = await fetch(`/api/connect/messages/${channelId}/${topicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Failed to send.')
        return
      }
      const msg = await res.json() as Message
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      setBody('')
      textareaRef.current?.focus()
    } catch {
      setError('Failed to send. Please try again.')
    } finally { setSending(false) }
  }

  const handleBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
  }, [])

  const grouped: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const date = formatDate(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === date) last.messages.push(msg)
    else grouped.push({ date, messages: [msg] })
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="h-12 bg-bg-raised border-b border-border flex items-center px-4 gap-3 shrink-0 z-10">
        <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-accent-fg">
            <path d="M4 5a1 1 0 011-1h14a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h6a1 1 0 010 2H5a1 1 0 01-1-1z"/>
          </svg>
        </div>
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <span className="text-fg-tertiary font-medium shrink-0">#</span>
          <span className="text-fg-secondary shrink-0">{channelName}</span>
          <span className="text-fg-tertiary shrink-0">›</span>
          <span className="font-medium text-fg-primary truncate">{topicName}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-medium text-fg-tertiary bg-bg-surface border border-border rounded-full px-2 py-0.5">
            Guest
          </span>
          <div className="w-7 h-7 bg-bg-surface border border-border rounded-full flex items-center justify-center">
            <span className="text-fg-secondary text-[10px] font-semibold">{initials(guestName)}</span>
          </div>
          <span className="text-sm text-fg-secondary hidden sm:block">{guestName}</span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
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
                  const isGrouped = prev?.author_id === msg.author_id &&
                    new Date(msg.created_at).getTime() - new Date(prev!.created_at).getTime() < 5 * 60_000
                  const isMe = msg.author_id === guestId

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 rounded px-1 ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
                    >
                      {isGrouped ? (
                        <div className="w-8 shrink-0 flex items-start justify-end pt-0.5">
                          <span className="text-[10px] text-fg-tertiary leading-none mt-1">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      ) : (
                        <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center mt-0.5 ${
                          msg.is_guest ? 'bg-bg-surface border border-border' : 'bg-accent/15'
                        }`}>
                          <span className={`text-xs font-semibold ${msg.is_guest ? 'text-fg-secondary' : 'text-accent'}`}>
                            {initials(msg.author_name)}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {!isGrouped && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-fg-primary">{msg.author_name}</span>
                            {msg.is_guest && (
                              <span className="text-[9px] font-medium text-fg-tertiary border border-border rounded px-1 py-px">
                                Guest
                              </span>
                            )}
                            {isMe && !msg.is_guest && (
                              <span className="text-[9px] font-medium text-accent border border-accent/30 rounded px-1 py-px">
                                You
                              </span>
                            )}
                            <span className="text-[11px] text-fg-tertiary">{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                        <p className="text-sm text-fg-primary leading-relaxed break-words whitespace-pre-wrap">
                          {msg.body}
                        </p>
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
      <div className="shrink-0 px-4 pb-3">
        {error && <p className="text-danger text-xs mb-1">{error}</p>}
        <div className="flex items-end gap-2 bg-bg-surface border border-border rounded-xl px-3 py-2 focus-within:border-accent/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder={`Message ${topicName}`}
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

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-4 py-2 flex items-center justify-between">
        <p className="text-[10px] text-fg-tertiary">
          Powered by <span className="font-medium text-fg-secondary">Foundry Channels</span>
        </p>
        <p className="text-[10px] text-fg-tertiary">{guestEmail}</p>
      </div>
    </div>
  )
}
