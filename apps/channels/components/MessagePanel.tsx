'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { SessionUser } from '@foundry/auth'
import { EmojiPicker } from './EmojiPicker'

type Reaction = { emoji: string; user_ids: string[] }
type Member = { id: string; name: string; email: string }

type Message = {
  id: string; author_id: string; author_name: string; author_email: string
  body: string; reactions: Reaction[]; edited_at: string | null; created_at: string
}

interface Props {
  orgSlug:        string
  session:        SessionUser
  channelId:      string
  channelName:    string
  topicId:        string
  topicName:      string | null
  isResolved:     boolean
  messages:       Message[]
  onNewMessage:   (msg: Message) => void
  onEditMessage:  (msg: Message) => void
  onDeleteMessage:(id: string) => void
  onReactMessage: (msg: Message) => void
  onToggleResolve:() => void
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

function renderBody(body: string): React.ReactNode {
  const parts = body.split(/(@\w+)/g)
  return parts.map((part, i) =>
    /^@\w+$/.test(part)
      ? <span key={i} className="text-accent font-medium">{part}</span>
      : part
  )
}

function initials(name: string) { return name.slice(0, 2).toUpperCase() }

export function MessagePanel({
  orgSlug, session, channelId, channelName,
  topicId, topicName, isResolved,
  messages, onNewMessage, onEditMessage, onDeleteMessage, onReactMessage, onToggleResolve,
}: Props) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [pickerMsgId, setPickerMsgId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Mark topic as read + fetch members
  useEffect(() => {
    if (topicId === '_new') return
    fetch('/api/channels/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId }),
    })
    fetch('/api/channels/members').then(r => r.json()).then(setMembers).catch(() => {})
  }, [topicId])

  async function send() {
    if (!body.trim() || sending || topicId === '_new') return
    setSending(true); setError('')
    try {
      const res = await fetch(`/api/channels/${channelId}/topics/${topicId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })
      if (!res.ok) { setError('Failed to send.'); return }
      onNewMessage(await res.json() as Message)
      setBody('')
      textareaRef.current?.focus()
    } finally { setSending(false) }
  }

  async function submitEdit(msgId: string) {
    if (!editBody.trim()) return
    const res = await fetch(`/api/channels/${channelId}/topics/${topicId}/messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editBody.trim() }),
    })
    if (res.ok) { onEditMessage(await res.json() as Message); setEditingId(null) }
  }

  async function deleteMsg(msgId: string) {
    const res = await fetch(`/api/channels/${channelId}/topics/${topicId}/messages/${msgId}`, { method: 'DELETE' })
    if (res.ok) { onDeleteMessage(msgId) }
  }

  async function react(msgId: string, emoji: string) {
    const res = await fetch(`/api/channels/${channelId}/topics/${topicId}/messages/${msgId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    })
    if (res.ok) { onReactMessage(await res.json() as Message) }
  }

  const handleBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setBody(val)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`

    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match = before.match(/@(\w*)$/)
    if (match) {
      setMentionQuery(match[1].toLowerCase())
      setMentionRange({ start: cursor - match[0].length, end: cursor })
    } else {
      setMentionQuery(null)
      setMentionRange(null)
    }
  }, [])

  function insertMention(name: string) {
    if (!mentionRange) return
    const newBody = body.slice(0, mentionRange.start) + `@${name} ` + body.slice(mentionRange.end)
    setBody(newBody)
    setMentionQuery(null)
    setMentionRange(null)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const filteredMembers = mentionQuery !== null
    ? members.filter(m => m.name.toLowerCase().startsWith(mentionQuery) && m.id !== session.userId)
    : []

  // Group by date
  const grouped: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const date = formatDate(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === date) last.messages.push(msg)
    else grouped.push({ date, messages: [msg] })
  }

  const isNew = topicId === '_new'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center px-4 gap-2 shrink-0 bg-bg-base">
        <span className="text-fg-tertiary font-medium">#</span>
        <span className="font-semibold text-fg-primary text-sm">{channelName}</span>
        {topicName && (
          <>
            <span className="text-fg-tertiary mx-1">›</span>
            <span className={`text-sm ${isResolved ? 'line-through text-fg-tertiary' : 'text-fg-secondary'}`}>
              {topicName}
            </span>
          </>
        )}
        {topicName && !isNew && (
          <button
            onClick={onToggleResolve}
            title={isResolved ? 'Reopen topic' : 'Resolve topic'}
            className={`ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
              isResolved
                ? 'border-accent/40 text-accent bg-accent/10 hover:bg-accent/20'
                : 'border-border text-fg-tertiary hover:text-fg-secondary hover:border-border-hover'
            }`}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
            {isResolved ? 'Resolved' : 'Resolve'}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isNew ? (
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
                  const isGrouped = prev?.author_id === msg.author_id &&
                    new Date(msg.created_at).getTime() - new Date(prev!.created_at).getTime() < 5 * 60_000
                  const isOwn = msg.author_id === session.userId
                  const isEditing = editingId === msg.id
                  const isHovered = hoveredId === msg.id
                  const reactionsArr: Reaction[] = Array.isArray(msg.reactions) ? msg.reactions : []

                  return (
                    <div
                      key={msg.id}
                      className={`relative flex gap-3 group rounded px-1 ${isGrouped ? 'mt-0.5' : 'mt-3'} hover:bg-bg-surface`}
                      onMouseEnter={() => setHoveredId(msg.id)}
                      onMouseLeave={() => { setHoveredId(null); if (pickerMsgId === msg.id) setPickerMsgId(null) }}
                    >
                      {/* Avatar or time gutter */}
                      {isGrouped ? (
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
                        {!isGrouped && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-fg-primary">{msg.author_name}</span>
                            <span className="text-[11px] text-fg-tertiary">{formatTime(msg.created_at)}</span>
                          </div>
                        )}

                        {isEditing ? (
                          <div className="mt-0.5">
                            <textarea
                              autoFocus
                              value={editBody}
                              onChange={e => setEditBody(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id) }
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              rows={1}
                              className="w-full bg-bg-raised border border-accent/40 rounded-lg px-3 py-2 text-sm text-fg-primary focus:outline-none resize-none leading-relaxed"
                            />
                            <p className="text-[10px] text-fg-tertiary mt-1">
                              <kbd>Enter</kbd> to save · <kbd>Esc</kbd> to cancel
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-fg-primary leading-relaxed break-words whitespace-pre-wrap">
                            {renderBody(msg.body)}
                          </p>
                        )}

                        {msg.edited_at && !isEditing && (
                          <span className="text-[10px] text-fg-tertiary">(edited)</span>
                        )}

                        {/* Reactions */}
                        {reactionsArr.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {reactionsArr.map(r => {
                              const mine = r.user_ids.includes(session.userId)
                              return (
                                <button
                                  key={r.emoji}
                                  onClick={() => react(msg.id, r.emoji)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                                    mine
                                      ? 'bg-accent/15 border-accent/40 text-accent'
                                      : 'bg-bg-surface border-border text-fg-secondary hover:border-accent/30'
                                  }`}
                                >
                                  <span>{r.emoji}</span>
                                  <span>{r.user_ids.length}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Hover action toolbar */}
                      {isHovered && !isEditing && (
                        <div className="absolute right-2 top-0 -translate-y-0 flex items-center gap-0.5 bg-bg-raised border border-border rounded-lg px-1 py-0.5 shadow-sm z-10">
                          {/* React */}
                          <div className="relative">
                            <button
                              onClick={() => setPickerMsgId(pickerMsgId === msg.id ? null : msg.id)}
                              className="p-1.5 rounded hover:bg-bg-hover transition-colors text-fg-tertiary hover:text-fg-secondary"
                              title="Add reaction"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zM7.75 9.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm4.5 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm-5.12 3.5a4.5 4.5 0 006.74 0 .75.75 0 111.06 1.06 6 6 0 01-8.86 0 .75.75 0 111.06-1.06z"/>
                              </svg>
                            </button>
                            {pickerMsgId === msg.id && (
                              <EmojiPicker
                                onSelect={emoji => react(msg.id, emoji)}
                                onClose={() => setPickerMsgId(null)}
                              />
                            )}
                          </div>

                          {/* Edit (own messages only) */}
                          {isOwn && (
                            <button
                              onClick={() => { setEditingId(msg.id); setEditBody(msg.body) }}
                              className="p-1.5 rounded hover:bg-bg-hover transition-colors text-fg-tertiary hover:text-fg-secondary"
                              title="Edit message"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z"/>
                                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z"/>
                              </svg>
                            </button>
                          )}

                          {/* Delete (own messages only) */}
                          {isOwn && (
                            <button
                              onClick={() => { if (confirm('Delete this message?')) deleteMsg(msg.id) }}
                              className="p-1.5 rounded hover:bg-bg-hover transition-colors text-fg-tertiary hover:text-danger"
                              title="Delete message"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
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
      {!isNew && (
        <div className="shrink-0 px-4 pb-4">
          {error && <p className="text-danger text-xs mb-1">{error}</p>}

          {/* @mention picker */}
          {filteredMembers.length > 0 && (
            <div className="mb-1 bg-bg-raised border border-border rounded-lg shadow-sm overflow-hidden">
              {filteredMembers.slice(0, 5).map(m => (
                <button
                  key={m.id}
                  onClick={() => insertMention(m.name)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-bg-hover text-sm text-fg-primary text-left transition-colors"
                >
                  <div className="w-5 h-5 bg-accent/15 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-accent text-[10px] font-semibold">{initials(m.name)}</span>
                  </div>
                  <span className="font-medium">{m.name}</span>
                  <span className="text-fg-tertiary text-xs">{m.email}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-bg-surface border border-border rounded-xl px-3 py-2 focus-within:border-accent/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={handleBodyChange}
              onKeyDown={e => {
                if (e.key === 'Escape') { setMentionQuery(null); setMentionRange(null) }
                if (e.key === 'Enter' && !e.shiftKey && !mentionQuery) { e.preventDefault(); send() }
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
            <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift+Enter</kbd> for new line · <kbd className="font-sans">@</kbd> to mention
          </p>
        </div>
      )}
    </div>
  )
}
