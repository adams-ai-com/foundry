'use client'

import { useEffect, useState, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import { formatDate } from '@owl/shared'
import type { MailThread } from '@owl/shared'
import { listThreads, searchThreads, archiveThread, trashThread, starThread } from '../lib/api'

export interface InboxViewHandle {
  reload: () => void
  removeThread: (id: string) => void
  getThreads: () => MailThread[]
}

export type AccountScope =
  | { type: 'all'; accountIds: string[] }
  | { type: 'group'; groupId: string; accountIds: string[] }
  | { type: 'account'; accountId: string }

interface InboxViewProps {
  mailbox: string
  selectedThread: MailThread | null
  onSelectThread: (thread: MailThread) => void
  accountScope?: AccountScope
}

function StarIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}
function StarFilledIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}
function ArchiveIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
}
function TrashIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
}
function ChevronLeftIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 19l-7-7 7-7"/></svg>
}
function ChevronRightIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 18l6-6-6-6"/></svg>
}

const PAGE_SIZE = 50

export const InboxView = forwardRef<InboxViewHandle, InboxViewProps>(
  function InboxView({ mailbox, selectedThread, onSelectThread, accountScope }, ref) {
    const [threads, setThreads] = useState<MailThread[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [searching, setSearching] = useState(false)
    const [page, setPage] = useState(1)
    const [sort, setSort] = useState<'newest' | 'oldest' | 'unread'>('newest')
    const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all')

    // Reset to page 1 when mailbox/filter/sort/scope changes
    const scopeKey = accountScope?.type === 'account' ? accountScope.accountId
      : accountScope?.type === 'group' ? accountScope.groupId
      : 'all'
    const prevKeyRef = useRef(`${mailbox}|${filter}|${sort}|${scopeKey}`)
    const key = `${mailbox}|${filter}|${sort}|${scopeKey}`
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
          const listOpts = accountScope?.type === 'account'
            ? { accountId: accountScope.accountId }
            : accountScope?.accountIds?.length
            ? { accountIds: accountScope.accountIds }
            : {}
          const { threads: rows, total: t } = await listThreads(mailbox, page, sort, listOpts)
          setThreads(rows)
          setTotal(t)
        }
      } catch {
        setThreads([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }, [mailbox, page, sort, filter, search, accountScope]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="w-80 border-r border-border flex flex-col flex-shrink-0 bg-bg-surface">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-raised">
          <h2 className="font-semibold text-sm capitalize text-fg-primary">{mailbox}</h2>
          {unreadCount > 0 && (
            <span className="text-xs bg-accent text-accent-fg rounded-full px-1.5 py-0.5 font-medium leading-none">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-border px-3 bg-bg-raised">
          {(['all', 'unread', 'starred'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setSearch('') }}
              className={`text-xs px-3 py-2 capitalize transition-colors ${
                filter === f
                  ? 'border-b-2 border-accent text-accent font-medium'
                  : 'text-fg-secondary hover:text-fg-primary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search + Sort row */}
        <div className="px-3 py-2 border-b border-border flex gap-2 items-center bg-bg-raised">
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 min-w-0 text-sm bg-bg-surface rounded-lg px-3 py-1.5 outline-none border border-border focus:ring-1 focus:ring-accent/40 text-fg-primary placeholder:text-fg-tertiary"
          />
          {!inSearch && !inFilter && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'newest' | 'oldest' | 'unread')}
              className="text-xs bg-bg-surface border border-border rounded-lg px-2 py-1.5 outline-none cursor-pointer text-fg-secondary flex-shrink-0"
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
            <div className="flex items-center justify-center py-8 text-fg-tertiary text-sm">
              {searching ? 'Searching…' : 'Loading…'}
            </div>
          )}

          {!loading && !searching && threads.length === 0 && (
            <div className="flex items-center justify-center py-8 text-fg-tertiary text-sm">
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
                className={`group relative border-b border-border cursor-pointer transition-colors ${
                  isSelected ? 'bg-bg-active' : 'hover:bg-bg-hover'
                }`}
                onClick={() => onSelectThread(thread)}
              >
                <div className="px-4 py-3 pr-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm truncate max-w-[140px] ${isUnread ? 'font-semibold text-fg-primary' : 'text-fg-secondary'}`}>
                      {senderLabel}
                    </span>
                    <span className="text-xs text-fg-tertiary flex-shrink-0 ml-2 tabular-nums">
                      {formatDate(thread.lastMessageAt)}
                    </span>
                  </div>
                  <div className={`text-sm truncate ${isUnread ? 'font-medium text-fg-primary' : 'text-fg-secondary'}`}>
                    {thread.subject}
                  </div>
                  <div className="text-xs text-fg-tertiary truncate mt-0.5">{thread.snippet}</div>
                </div>

                {/* Unread indicator */}
                {isUnread && (
                  <div className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-accent" />
                )}

                {/* Hover actions */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-bg-raised rounded-lg shadow-card border border-border px-1 py-1">
                  <button
                    onClick={(e) => handleAction(e, thread, 'star')}
                    title={thread.isStarred ? 'Unstar' : 'Star'}
                    className={`p-1 rounded hover:bg-bg-hover transition-colors ${
                      thread.isStarred ? 'text-amber-400' : 'text-fg-tertiary hover:text-amber-400'
                    }`}
                  >
                    {thread.isStarred ? <StarFilledIcon className="w-3.5 h-3.5" /> : <StarIcon className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={(e) => handleAction(e, thread, 'archive')}
                    title="Archive (e)"
                    className="p-1 rounded hover:bg-bg-hover transition-colors text-fg-tertiary hover:text-fg-primary"
                  >
                    <ArchiveIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleAction(e, thread, 'trash')}
                    title="Trash (#)"
                    className="p-1 rounded hover:bg-bg-hover transition-colors text-fg-tertiary hover:text-danger"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {!inSearch && !inFilter && totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border flex-shrink-0 bg-bg-raised">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary disabled:opacity-40 px-2 py-1 rounded hover:bg-bg-hover transition-colors"
            >
              <ChevronLeftIcon className="w-3 h-3" />Prev
            </button>
            <span className="text-xs text-fg-tertiary tabular-nums">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary disabled:opacity-40 px-2 py-1 rounded hover:bg-bg-hover transition-colors"
            >
              Next<ChevronRightIcon className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    )
  }
)
