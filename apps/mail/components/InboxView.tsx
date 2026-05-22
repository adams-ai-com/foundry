'use client'

import { useEffect, useState, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import { formatDate } from '@foundry/shared'
import type { MailThread } from '@foundry/shared'
import { listThreads, searchThreads, archiveThread, trashThread, starThread } from '../lib/api'

export interface InboxViewHandle {
  reload: () => void
  removeThread: (id: string) => void
  getThreads: () => MailThread[]
}

interface InboxViewProps {
  mailbox: string
  selectedThread: MailThread | null
  onSelectThread: (thread: MailThread) => void
}

const PAGE_SIZE = 50

export const InboxView = forwardRef<InboxViewHandle, InboxViewProps>(
  function InboxView({ mailbox, selectedThread, onSelectThread }, ref) {
    const [threads, setThreads] = useState<MailThread[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [searching, setSearching] = useState(false)
    const [page, setPage] = useState(1)
    const [sort, setSort] = useState<'newest' | 'oldest' | 'unread'>('newest')
    const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all')

    // Reset to page 1 when mailbox/filter/sort changes
    const prevKeyRef = useRef(`${mailbox}|${filter}|${sort}`)
    const key = `${mailbox}|${filter}|${sort}`
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key
      if (page !== 1) setPage(1)
    }

    const load = useCallback(async () => {
      if (search.trim()) return
      setLoading(true)
      try {
        if (filter === 'unread') {
          const rows = await searchThreads('is:unread')
          setThreads(rows)
          setTotal(rows.length)
        } else if (filter === 'starred') {
          const rows = await searchThreads('is:starred')
          setThreads(rows)
          setTotal(rows.length)
        } else {
          const { threads: rows, total: t } = await listThreads(mailbox, page, sort)
          setThreads(rows)
          setTotal(t)
        }
      } catch {
        setThreads([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }, [mailbox, page, sort, filter, search])

    useEffect(() => { load() }, [load])

    useImperativeHandle(ref, () => ({
      reload: load,
      removeThread: (id: string) => setThreads((prev) => prev.filter((t) => t.id !== id)),
      getThreads: () => threads,
    }), [load, threads])

    const handleSearch = async (q: string) => {
      setSearch(q)
      if (!q.trim()) { load(); return }
      setSearching(true)
      try {
        const rows = await searchThreads(q.trim())
        setThreads(rows)
        setTotal(rows.length)
      } finally {
        setSearching(false)
      }
    }

    const handleAction = async (
      e: React.MouseEvent,
      thread: MailThread,
      action: 'star' | 'archive' | 'trash',
    ) => {
      e.stopPropagation()
      try {
        if (action === 'star') {
          await starThread(thread.id, !thread.isStarred)
          setThreads((prev) => prev.map((t) => t.id === thread.id ? { ...t, isStarred: !t.isStarred } : t))
        } else if (action === 'archive') {
          await archiveThread(thread.id)
          setThreads((prev) => prev.filter((t) => t.id !== thread.id))
        } else if (action === 'trash') {
          await trashThread(thread.id)
          setThreads((prev) => prev.filter((t) => t.id !== thread.id))
        }
      } catch { /* ignore */ }
    }

    const unreadCount = threads.filter((t) => t.unreadCount > 0).length
    const totalPages = Math.ceil(total / PAGE_SIZE)
    const inSearch = !!search.trim() || searching
    const inFilter = filter !== 'all'

    return (
      <div className="w-80 border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-sm capitalize">{mailbox}</h2>
          {unreadCount > 0 && (
            <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5 font-medium">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-gray-100 px-3">
          {(['all', 'unread', 'starred'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setSearch('') }}
              className={`text-xs px-3 py-2 capitalize transition-colors ${
                filter === f
                  ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search + Sort row */}
        <div className="px-3 py-2 border-b border-gray-100 flex gap-2 items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 min-w-0 text-sm bg-gray-100 rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-400"
          />
          {!inSearch && !inFilter && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'newest' | 'oldest' | 'unread')}
              className="text-xs bg-gray-100 rounded px-2 py-1.5 outline-none cursor-pointer text-gray-600 flex-shrink-0"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="unread">Unread</option>
            </select>
          )}
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {(loading || searching) && (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
              {searching ? 'Searching…' : 'Loading…'}
            </div>
          )}

          {!loading && !searching && threads.length === 0 && (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
              {inSearch ? 'No results' : 'No messages'}
            </div>
          )}

          {!loading && !searching && threads.map((thread) => {
            const sender = thread.participants[0]
            const senderLabel = sender?.name ?? sender?.email ?? '—'
            const isUnread = thread.unreadCount > 0
            const isSelected = selectedThread?.id === thread.id

            return (
              <div
                key={thread.id}
                className={`group relative border-b border-gray-100 cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => onSelectThread(thread)}
              >
                <div className="px-4 py-3 pr-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm truncate max-w-[140px] ${isUnread ? 'font-semibold' : 'text-gray-700'}`}>
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
                </div>

                {/* Unread indicator */}
                {isUnread && (
                  <div className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-blue-600" />
                )}

                {/* Hover actions */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-white rounded shadow-sm border border-gray-100 px-0.5 py-0.5">
                  <button
                    onClick={(e) => handleAction(e, thread, 'star')}
                    title={thread.isStarred ? 'Unstar' : 'Star'}
                    className={`p-1 rounded hover:bg-gray-100 text-sm leading-none transition-colors ${
                      thread.isStarred ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'
                    }`}
                  >
                    ★
                  </button>
                  <button
                    onClick={(e) => handleAction(e, thread, 'archive')}
                    title="Archive (e)"
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <polyline points="21 8 21 21 3 21 3 8" />
                      <rect x="1" y="3" width="22" height="5" />
                      <line x1="10" y1="12" x2="14" y2="12" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleAction(e, thread, 'trash')}
                    title="Trash (#)"
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {!inSearch && !inFilter && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    )
  }
)
