'use client'

import { useEffect, useState } from 'react'
import { InboxView } from './InboxView'
import { MessageReader } from './MessageReader'
import { CalendarView } from './CalendarView'
import { TasksView } from './TasksView'
import { DecisionsView } from './DecisionsView'
import { FilesView } from './FilesView'
import { ChannelsView } from './ChannelsView'
import { ComposeModal } from './ComposeModal'
import type { MailThread, MailboxInfo } from '@foundry/shared'
import { listMailboxes } from '../lib/api'

type View = 'mail' | 'calendar' | 'contacts' | 'tasks' | 'decisions' | 'files' | 'channels'

const SYSTEM_MAILBOXES = ['inbox', 'sent', 'drafts', 'archive', 'trash', 'spam']

export function MailShell() {
  const [view, setView] = useState<View>('mail')
  const [mailbox, setMailbox] = useState('inbox')
  const [selectedThread, setSelectedThread] = useState<MailThread | null>(null)
  const [composing, setComposing] = useState(false)
  const [replyTo, setReplyTo] = useState<MailThread | undefined>(undefined)
  const [mailboxes, setMailboxes] = useState<MailboxInfo[]>([])

  useEffect(() => {
    listMailboxes().then(setMailboxes).catch(() => setMailboxes([]))
  }, [])

  const handleSelectMailbox = (path: string) => {
    setMailbox(path)
    setSelectedThread(null)
    setView('mail')
  }

  const handleReply = (thread: MailThread) => {
    setReplyTo(thread)
    setComposing(true)
  }

  const handleCompose = () => {
    setReplyTo(undefined)
    setComposing(true)
  }

  const mailboxLabel = (path: string) =>
    path.charAt(0).toUpperCase() + path.slice(1)

  const sidebarMailboxes: { path: string; unreadCount: number }[] = SYSTEM_MAILBOXES.map((path) => {
    const found = mailboxes.find((m) => m.path === path)
    return { path, unreadCount: found?.unreadCount ?? 0 }
  })

  const customMailboxes = mailboxes.filter((m) => !SYSTEM_MAILBOXES.includes(m.path))

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
        <div className="p-2 border-b border-gray-200">
          <button
            onClick={handleCompose}
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
                onClick={() => setView(id)}
                className={`flex items-center text-sm px-3 py-1.5 rounded w-full text-left transition-colors ${
                  view === id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex">
        {view === 'mail' && (
          <>
            <InboxView
              mailbox={mailbox}
              selectedThread={selectedThread}
              onSelectThread={setSelectedThread}
            />
            <MessageReader thread={selectedThread} onReply={handleReply} />
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
          onClose={() => setComposing(false)}
          replyTo={replyTo}
        />
      )}
    </div>
  )
}
