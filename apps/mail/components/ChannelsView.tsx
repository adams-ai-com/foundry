'use client'

import { useState, useEffect, useRef } from 'react'
import {
  listChannels,
  createChannel,
  deleteChannel,
  listChannelMessages,
  postChannelMessage,
  deleteChannelMessage,
  type Channel,
  type ChannelMessage,
} from '../lib/api'

const SENDER_EMAIL = process.env.NEXT_PUBLIC_MAIL_FROM ?? 'user@foundry.local'
const SENDER_NAME = process.env.NEXT_PUBLIC_DISPLAY_NAME ?? SENDER_EMAIL.split('@')[0]

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function senderInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function avatarColor(email: string): string {
  const colors = [
    'bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-orange-500',
    'bg-pink-600', 'bg-teal-600', 'bg-indigo-600', 'bg-red-600',
  ]
  let hash = 0
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return colors[Math.abs(hash) % colors.length]
}

export function ChannelsView() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageIdRef = useRef<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load channels
  useEffect(() => {
    listChannels()
      .then((chs) => {
        setChannels(chs)
        if (chs.length > 0) setActiveChannel(chs[0])
      })
      .finally(() => setLoadingChannels(false))
  }, [])

  // Load messages + connect SSE when channel changes
  useEffect(() => {
    if (!activeChannel) return

    setLoadingMessages(true)
    setMessages([])
    lastMessageIdRef.current = null

    // Close any existing SSE connection
    esRef.current?.close()
    esRef.current = null

    let cancelled = false

    listChannelMessages(activeChannel.id)
      .then((msgs) => {
        if (cancelled) return
        setMessages(msgs)
        lastMessageIdRef.current = msgs.at(-1)?.id ?? null

        // Connect SSE for live updates starting from last loaded message
        const url = new URL(`/mail/api/sse/channel/${activeChannel.id}`, window.location.origin)
        if (lastMessageIdRef.current) url.searchParams.set('after', lastMessageIdRef.current)

        const es = new EventSource(url.toString())
        es.onmessage = (event) => {
          if (cancelled) return
          try {
            const { type, message } = JSON.parse(event.data) as { type: string; message: ChannelMessage }
            if (type === 'message:new') {
              setMessages((prev) => [...prev, message])
              lastMessageIdRef.current = message.id
            }
          } catch { /* ignore parse errors */ }
        }
        esRef.current = es
      })
      .finally(() => { if (!cancelled) setLoadingMessages(false) })

    return () => {
      cancelled = true
      esRef.current?.close()
      esRef.current = null
    }
  }, [activeChannel])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!draft.trim() || !activeChannel || sending) return
    setSending(true)
    const body = draft.trim()
    setDraft('')
    try {
      const msg = await postChannelMessage(activeChannel.id, body)
      setMessages((prev) => [...prev, msg])
      lastMessageIdRef.current = msg.id
    } catch {
      setDraft(body)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleDeleteMessage(msg: ChannelMessage) {
    if (!activeChannel) return
    await deleteChannelMessage(activeChannel.id, msg.id)
    setMessages((prev) => prev.filter((m) => m.id !== msg.id))
  }

  async function handleDeleteChannel(ch: Channel) {
    if (ch.name === 'general') return
    await deleteChannel(ch.id)
    const updated = channels.filter((c) => c.id !== ch.id)
    setChannels(updated)
    if (activeChannel?.id === ch.id) setActiveChannel(updated[0] ?? null)
  }

  function shouldShowHeader(i: number): boolean {
    if (i === 0) return true
    const prev = messages[i - 1]
    const cur = messages[i]
    if (prev.senderEmail !== cur.senderEmail) return true
    const gap = new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime()
    return gap > 5 * 60 * 1000
  }

  return (
    <div className="flex h-full bg-bg-surface">
      {/* Channel sidebar */}
      <aside className="w-48 border-r border-border flex flex-col flex-shrink-0 bg-bg-surface">
        <div className="px-3 pt-4 pb-2 flex items-center justify-between border-b border-border">
          <span className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Channels</span>
          <button
            data-testid="new-channel-button"
            onClick={() => setShowNewChannel(true)}
            className="text-fg-tertiary hover:text-fg-primary text-lg leading-none transition-colors"
            title="New channel"
          >
            +
          </button>
        </div>

        {loadingChannels ? (
          <div className="px-3 py-2 text-xs text-fg-tertiary">Loading…</div>
        ) : (
          <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {channels.map((ch) => (
              <button
                key={ch.id}
                data-testid={`channel-item-${ch.name}`}
                onClick={() => setActiveChannel(ch)}
                className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded text-sm group transition-colors ${
                  activeChannel?.id === ch.id
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary'
                }`}
              >
                <span className="truncate"><span className="opacity-60">#</span>{ch.name}</span>
                {ch.name !== 'general' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteChannel(ch) }}
                    className="opacity-0 group-hover:opacity-100 text-xs hover:text-danger ml-1 transition-opacity"
                  >
                    ×
                  </button>
                )}
              </button>
            ))}
          </nav>
        )}
      </aside>

      {/* Message area */}
      <div className="flex-1 flex flex-col min-w-0 bg-bg-base">
        {!activeChannel ? (
          <div className="flex-1 flex items-center justify-center text-fg-tertiary text-sm">
            Select a channel
          </div>
        ) : (
          <>
            {/* Channel header */}
            <div className="border-b border-border px-4 py-3 flex-shrink-0 bg-bg-surface">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-fg-primary">#{activeChannel.name}</span>
                {activeChannel.description && (
                  <span className="text-xs text-fg-tertiary">{activeChannel.description}</span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
              {loadingMessages ? (
                <div className="text-center text-fg-tertiary text-sm py-8">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-fg-tertiary text-sm py-8">
                  No messages yet. Say hello in #{activeChannel.name}!
                </div>
              ) : (
                messages.map((msg, i) => {
                  const showHeader = shouldShowHeader(i)
                  const isOwn = msg.senderEmail === SENDER_EMAIL
                  return (
                    <div key={msg.id} className={`group ${showHeader ? 'mt-4 first:mt-0' : ''}`}>
                      {showHeader && (
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(msg.senderEmail)}`}>
                            {senderInitials(msg.senderName || msg.senderEmail)}
                          </div>
                          <span className="text-sm font-medium text-fg-primary">
                            {msg.senderName || msg.senderEmail.split('@')[0]}
                          </span>
                          <span className="text-xs text-fg-tertiary">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className="flex items-start pl-9 gap-2">
                        <p className="text-sm text-fg-secondary whitespace-pre-wrap flex-1 leading-relaxed">
                          {msg.body}
                        </p>
                        {isOwn && (
                          <button
                            onClick={() => handleDeleteMessage(msg)}
                            className="opacity-0 group-hover:opacity-100 text-xs text-fg-tertiary hover:text-danger flex-shrink-0 mt-0.5 transition-opacity"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div className="border-t border-border p-3 flex-shrink-0 bg-bg-surface">
              <div className="flex items-end gap-2 bg-bg-raised border border-border rounded-lg px-3 py-2">
                <textarea
                  ref={inputRef}
                  data-testid="message-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${activeChannel.name}`}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-tertiary resize-none focus:outline-none min-h-[24px] max-h-32"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const t = e.currentTarget
                    t.style.height = 'auto'
                    t.style.height = t.scrollHeight + 'px'
                  }}
                />
                <button
                  data-testid="message-send-button"
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="text-accent hover:text-accent/80 disabled:opacity-30 flex-shrink-0 pb-0.5 transition-colors"
                  title="Send (Enter)"
                >
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.5 1.5l13 6.5-13 6.5V9.5l9-2.5-9-2.5V1.5z"/>
                  </svg>
                </button>
              </div>
              <p className="text-xs text-fg-tertiary mt-1 px-1">Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>

      {showNewChannel && (
        <NewChannelModal
          onClose={() => setShowNewChannel(false)}
          onCreated={(ch) => {
            setChannels((prev) => [...prev, ch])
            setActiveChannel(ch)
            setShowNewChannel(false)
          }}
        />
      )}
    </div>
  )
}

function NewChannelModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (ch: Channel) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const ch = await createChannel({ name: name.trim(), description: description.trim() || undefined })
      onCreated(ch)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create channel')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-bg-raised border border-border rounded-lg w-full max-w-sm mx-4 p-5 shadow-card">
        <h3 className="text-sm font-semibold text-fg-primary mb-4">New Channel</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-fg-secondary block mb-1">Channel name</label>
            <div className="flex items-center bg-bg-surface border border-border rounded px-3 py-2 focus-within:border-accent transition-colors">
              <span className="text-fg-tertiary text-sm mr-1">#</span>
              <input
                autoFocus
                data-testid="channel-name-input"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
                placeholder="e.g. engineering"
                className="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none"
              />
            </div>
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-bg-surface border border-border rounded px-3 py-2 text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-accent transition-colors"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-fg-secondary hover:text-fg-primary px-3 py-1.5 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              data-testid="channel-create-button"
              disabled={saving || !name.trim()}
              className="text-sm bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-fg px-4 py-1.5 rounded transition-colors"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
