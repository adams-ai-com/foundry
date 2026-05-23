'use client'

import { useState, useEffect, useRef } from 'react'

type Notification = {
  id: string
  type: string
  read_at: string | null
  created_at: string
  channel_id: string
  topic_id: string | null
  channel_name: string
  topic_name: string | null
  author_name: string | null
  body: string | null
}

interface Props {
  orgSlug: string
  count: number
  onCountChange: (n: number) => void
}

function excerpt(body: string | null, max = 60): string {
  if (!body) return ''
  return body.length > max ? body.slice(0, max) + '…' : body
}

export function NotificationBell({ orgSlug, count, onCountChange }: Props) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function openPanel() {
    setOpen(v => !v)
    if (!open) {
      setLoading(true)
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) {
          const data = await res.json() as { count: number; notifications: Notification[] }
          setNotifications(data.notifications)
          onCountChange(data.count)
        }
      } finally { setLoading(false) }
    }
  }

  async function markAllRead() {
    await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
    onCountChange(0)
  }

  async function markRead(id: string) {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    onCountChange(Math.max(0, count - 1))
  }

  function navTo(n: Notification) {
    markRead(n.id)
    const path = n.topic_id
      ? `/org/${orgSlug}/${n.channel_id}/${n.topic_id}`
      : `/org/${orgSlug}/${n.channel_id}`
    window.location.href = path
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={openPanel}
        className="relative p-1.5 rounded-lg hover:bg-bg-hover transition-colors text-fg-tertiary hover:text-fg-secondary"
        title="Notifications"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 100-4 2 2 0 000 4z"/>
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-bg-raised border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-sm font-semibold text-fg-primary">Notifications</span>
            {count > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-fg-tertiary">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => navTo(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-bg-hover transition-colors border-b border-border last:border-0 ${
                    !n.read_at ? 'bg-accent/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && (
                      <div className="w-1.5 h-1.5 bg-accent rounded-full shrink-0 mt-1.5" />
                    )}
                    <div className={!n.read_at ? '' : 'ml-3.5'}>
                      <p className="text-xs text-fg-tertiary mb-0.5">
                        {n.type === 'mention' ? '@ Mentioned in' : 'New message in'}{' '}
                        <span className="text-fg-secondary font-medium">#{n.channel_name}</span>
                        {n.topic_name && <span className="text-fg-tertiary"> › {n.topic_name}</span>}
                      </p>
                      {n.author_name && (
                        <p className="text-sm text-fg-primary leading-snug">
                          <span className="font-medium">{n.author_name}:</span>{' '}
                          <span className="text-fg-secondary">{excerpt(n.body)}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-fg-tertiary mt-1">
                        {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
