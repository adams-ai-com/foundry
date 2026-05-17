'use client'

import { formatDate } from '@foundry/shared'
import type { MailThread } from '@foundry/shared'

interface InboxViewProps {
  selectedThread: MailThread | null
  onSelectThread: (thread: MailThread) => void
}

// Placeholder threads for the prototype UI
const SAMPLE_THREADS: MailThread[] = [
  {
    id: '1',
    subject: 'Welcome to Foundry Mail',
    participants: ['team@foundry.app'],
    lastMessageAt: new Date(),
    messageCount: 1,
    unread: true,
    snippet: 'Your self-hosted mail is ready. This is a placeholder thread for the prototype.',
  },
]

export function InboxView({ selectedThread, onSelectThread }: InboxViewProps) {
  return (
    <div className="w-80 border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-sm">Inbox</h2>
        <span className="text-xs text-gray-400">{SAMPLE_THREADS.filter((t) => t.unread).length} unread</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {SAMPLE_THREADS.map((thread) => (
          <button
            key={thread.id}
            onClick={() => onSelectThread(thread)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              selectedThread?.id === thread.id ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm truncate ${thread.unread ? 'font-semibold' : 'text-gray-700'}`}>
                {thread.participants[0]}
              </span>
              <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                {formatDate(thread.lastMessageAt)}
              </span>
            </div>
            <div className={`text-sm truncate ${thread.unread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
              {thread.subject}
            </div>
            <div className="text-xs text-gray-400 truncate mt-0.5">{thread.snippet}</div>
            {thread.unread && (
              <div className="w-2 h-2 rounded-full bg-blue-600 absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
