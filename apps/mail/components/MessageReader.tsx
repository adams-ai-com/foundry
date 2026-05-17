'use client'

import type { MailThread } from '@foundry/shared'
import { formatDate } from '@foundry/shared'

interface MessageReaderProps {
  thread: MailThread | null
}

export function MessageReader({ thread }: MessageReaderProps) {
  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Select a message to read
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold">{thread.subject}</h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
          <span>{thread.participants.join(', ')}</span>
          <span>·</span>
          <span>{formatDate(thread.lastMessageAt)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 prose max-w-none text-sm">
        <p className="text-gray-500 italic">Message body will render here once connected to Stalwart Mail via JMAP.</p>
        <p className="text-gray-400 text-xs mt-4">
          Wire up <code>lib/jmap-client.ts</code> → <code>fetchThread(thread.id)</code> → render message HTML.
        </p>
      </div>

      <div className="border-t border-gray-200 px-6 py-3">
        <button className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors">
          Reply
        </button>
        <button className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded ml-2 transition-colors">
          Forward
        </button>
      </div>
    </div>
  )
}
