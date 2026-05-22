'use client'

import { useEffect, useState, useRef } from 'react'
import { InboxView, type InboxViewHandle } from './InboxView'
import { MessageReader } from './MessageReader'
import { CalendarView } from './CalendarView'
import { TasksView } from './TasksView'
import { DecisionsView } from './DecisionsView'
import { FilesView } from './FilesView'
import { ChannelsView } from './ChannelsView'
import { ComposeModal, type ComposeRequest } from './ComposeModal'
import type { MailThread, MailboxInfo } from '@foundry/shared'
import { listMailboxes, archiveThread, trashThread, starThread, markThreadUnread } from '../lib/api'

type View = 'mail' | 'calendar' | 'contacts' | 'tasks' | 'decisions' | 'files' | 'channels'

const SYSTEM_MAILBOXES = ['inbox', 'starred', 'sent', 'drafts', 'archive', 'trash', 'spam']

const SHORTCUTS = [
  { key: 'j', desc: 'Next thread' },
  { key: 'k', desc: 'Previous thread' },
  { key: 'c', desc: 'Compose' },
  { key: 'r', desc: 'Reply' },
  { key: 'a', desc: 'Reply all' },
  { key: 'e', desc: 'Archive' },
  { key: '#', desc: 'Trash' },
  { key: 's', desc: 'Star / Unstar' },
  { key: 'u', desc: 'Mark unread' },
  { key: '?', desc: 'Show shortcuts' },
]

export function MailShell() {
  const [view, setView] = useState<View>('mail')
  const [mailbox, setMailbox] = useState('inbox')
  const [selectedThread, setSelectedThread] = useState<MailThread | null>(null)
  const [composing, setComposing] = useState(false)
  const [composeRequest, setComposeRequest] = useState<ComposeRequest | undefined>(undefined)
  const [mailboxes, setMailboxes] = useState<MailboxInfo[]>([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const inboxRef = useRef<InboxViewHandle>(null)

  useEffect(() => {
    listMailboxes().then(setMailboxes).catch(() => setMailboxes([]))
  }, [])

  const handleSelectMailbox = (path: string) => {
    setMailbox(path)
    setSelectedThread(null)
    setView('mail')
  }

  const handleCompose = (req?: ComposeRequest) => {
    setComposeRequest(req)
    setComposing(true)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      // Don't fire in inputs, textareas, select, contenteditable
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (['input', 'textarea', 'select'].includes(tag)) return
      if ((e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (composing) return

      const threads = inboxRef.current?.getThreads() ?? []
      const idx = threads.findIndex((t) => t.id === selectedThread?.id)

      switch (e.key) {
        case 'j': {
          if (view !== 'mail') break
          const next = threads[idx + 1] ?? threads[0]
          if (next) setSelectedThread(next)
          break
        }
        case 'k': {
          if (view !== 'mail') break
          const prev = threads[idx - 1] ?? threads[threads.length - 1]
          if (prev) setSelectedThread(prev)
          break
        }
        case 'c':
          handleCompose()
          break
        case 'r':
          if (selectedThread && view === 'mail') handleCompose({ replyTo: selectedThread })
          break
        case 'a':
          if (selectedThread && view === 'mail') handleCompose({ replyTo: selectedThread, replyAll: true })
          break
        case 'e': {
          if (!selectedThread || view !== 'mail') break
          const id = selectedThread.id
          await archiveThread(id)
          inboxRef.current?.removeThread(id)
          setSelectedThread(null)
          break
        }
        case '#': {
          if (!selectedThread || view !== 'mail') break
          const id = selectedThread.id
          await trashThread(id)
          inboxRef.current?.removeThread(id)
          setSelectedThread(null)
          break
        }
        case 's': {
          if (!selectedThread || view !== 'mail') break
          const starred = !selectedThread.isStarred
          await starThread(selectedThread.id, starred)
          setSelectedThread((t) => t ? { ...t, isStarred: starred } : t)
          break
        }
        case 'u': {
          if (!selectedThread || view !== 'mail') break
          await markThreadUnread(selectedThread.id)
          setSelectedThread(null)
          break
        }
        case '?':
          e.preventDefault()
          setShowShortcuts((v) => !v)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, selectedThread, composing]) // eslint-disable-line react-hooks/exhaustive-deps

  const mailboxLabel = (path: string) =>
    path.charAt(0).toUpperCase() + path.slice(1)

  const sidebarMailboxes: { path: string; unreadCount: number }[] = SYSTEM_MAILBOXES.map((path) => {
    const found = mailboxes.find((m) => m.path === path)
    return { path, unreadCount: found?.unreadCount ?? 0 }
  })

  const customMailboxes = mailboxes.filter((m) => !SYSTEM_MAILBOXES.includes(m.path))

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <aside className="w-52 border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="font-semibold text-sm">Foundry Mail</span>
          </div>
        </div>

        <div className="p-2">
          <button
            data-testid="compose-button"
            onClick={() => handleCompose()}
            className="w-full bg-blue-600 text-white text-sm px-3 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
          >
            Compose
          </button>
        </div>

        <nav className="p-2 flex flex-col gap-0.5 overflow-y-auto flex-1">
          {sidebarMailboxes.map(({ path, unreadCount }) => (
            <button
              key={path}
              onClick={() => handleSelectMailbox(path)}
              className={`flex items-center justify-between text-sm px-3 py-1.5 rounded w-full text-left transition-colors ${
                view === 'mail' && mailbox === path
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{mailboxLabel(path)}</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5 font-medium">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}

          {customMailboxes.length > 0 && (
            <>
              <div className="text-xs text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1">Folders</div>
              {customMailboxes.map((m) => (
                <button
                  key={m.path}
                  onClick={() => handleSelectMailbox(m.path)}
                  className={`flex items-center justify-between text-sm px-3 py-1.5 rounded w-full text-left transition-colors ${
                    view === 'mail' && mailbox === m.path
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{m.displayName}</span>
                  {m.unreadCount > 0 && (
                    <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5">
                      {m.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}

          <div className="border-t border-gray-200 mt-2 pt-2">
            {([
              { id: 'calendar' as View, label: 'Calendar' },
              { id: 'contacts' as View, label: 'Contacts' },
              { id: 'tasks' as View, label: 'Tasks' },
              { id: 'decisions' as View, label: 'Decisions' },
              { id: 'channels' as View, label: 'Channels' },
              { id: 'files' as View, label: 'Files' },
            ]).map(({ id, label }) => (
              <button
                key={id}
                data-testid={`nav-${id}`}
                onClick={() => setView(id)}
                className={`flex items-center text-sm px-3 py-1.5 rounded w-full text-left transition-colors ${
                  view === id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-auto pt-2 border-t border-gray-200">
            <button
              onClick={() => setShowShortcuts(true)}
              className="flex items-center text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 w-full text-left"
            >
              <span className="mr-1.5 font-mono bg-gray-200 rounded px-1">?</span> Keyboard shortcuts
            </button>
          </div>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex">
        {view === 'mail' && (
          <>
            <InboxView
              ref={inboxRef}
              mailbox={mailbox}
              selectedThread={selectedThread}
              onSelectThread={setSelectedThread}
            />
            <MessageReader
              thread={selectedThread}
              onCompose={handleCompose}
            />
          </>
        )}
        {view === 'calendar' && <CalendarView />}
        {view === 'contacts' && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Contacts coming soon
          </div>
        )}
        {view === 'tasks' && (
          <div className="flex-1 overflow-hidden bg-gray-900 text-gray-200">
            <TasksView />
          </div>
        )}
        {view === 'decisions' && (
          <div className="flex-1 overflow-hidden bg-gray-900 text-gray-200">
            <DecisionsView />
          </div>
        )}
        {view === 'channels' && (
          <div className="flex-1 overflow-hidden bg-gray-900 text-gray-200">
            <ChannelsView />
          </div>
        )}
        {view === 'files' && (
          <div className="flex-1 overflow-hidden bg-gray-900 text-gray-200 relative">
            <FilesView />
          </div>
        )}
      </main>

      {composing && (
        <ComposeModal
          onClose={() => { setComposing(false); setComposeRequest(undefined) }}
          request={composeRequest}
        />
      )}

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Keyboard shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {SHORTCUTS.map(({ key, desc }) => (
                  <tr key={key} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 pr-4">
                      <kbd className="font-mono bg-gray-100 rounded px-1.5 py-0.5 text-xs">{key}</kbd>
                    </td>
                    <td className="py-1.5 text-gray-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
