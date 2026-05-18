'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatDate } from '@foundry/shared'
import type { MailThread } from '@foundry/shared'
import { listThreads, searchThreads } from '../lib/api'

interface InboxViewProps {
  mailbox: string
  selectedThread: MailThread | null
  onSelectThread: (thread: MailThread) => void
}

export function InboxView({ mailbox, selectedThread, onSelectThread }: InboxViewProps) {
  const [threads, setThreads] = useState<MailThread[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listThreads(mailbox)
      setThreads(rows)
    } catch {
      setThreads([])
    } finally {
      setLoading(false)
    }
  }, [mailbox])

  useEffect(() => { load() }, [load])

  const handleSearch = async (q: string) => {
    setSearch(q)
    if (!q.trim()) { load(); return }
    setSearching(true)
    try {
      const rows = await searchThreads(q.trim())
      setThreads(rows)
    } finally {
      setSearching(false)
    }
  }

  const unread = threads.filter((t) => t.unreadCount > 0).length

  return (
    <div className="w-80 border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-sm capitalize">{mailbox}</h2>
        {unread > 0 && (
          <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5 font-medium">
            {unread}
          </span>
        )}
      </div>

      <div className="px-3 py-2 border-b border-gray-100">
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search…"
          className="w-full text-sm bg-gray-100 rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {(loading || searching) && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            {searching ? 'Searching…' : 'Loading…'}
          </div>
        )}

        {!loading && !searching && threads.length === 0 && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            {search ? 'No results' : 'No messages'}
          </div>
        )}

        {!loading && !searching && threads.map((thread) => {
          const sender = thread.participants[0]
          const senderLabel = sender?.name ?? sender?.email ?? '—'
          const isUnread = thread.unreadCount > 0

          return (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread)}
              className={`relative w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedThread?.id === thread.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm truncate ${isUnread ? 'font-semibold' : 'text-gray-700'}`}>
                  {senderLabel}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {formatDate(thread.lastMessageAt)}
                </span>
              </div>
              <div className={`text-sm truncate ${isUnread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                {thread.subject}
              </div>
              <div className="text-xs text-gray-400 truncate mt-0.5">{thread.snippet}</div>
              {isUnread && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-600" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
