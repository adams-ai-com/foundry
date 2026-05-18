'use client'

import { useEffect, useState } from 'react'
import type { MailThread, MailMessage } from '@foundry/shared'
import { getThread } from '../lib/api'

interface MessageReaderProps {
  thread: MailThread | null
  onReply: (thread: MailThread) => void
}

export function MessageReader({ thread, onReply }: MessageReaderProps) {
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!thread) { setMessages([]); return }
    setLoading(true)
    getThread(thread.id)
      .then(({ messages }) => setMessages(messages))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [thread?.id])

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
        <div className="text-sm text-gray-500 mt-1">
          {thread.participants.map((p) => p.name ?? p.email).join(', ')}
          {' · '}
          {thread.messageCount} {thread.messageCount === 1 ? 'message' : 'messages'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            Loading…
          </div>
        )}

        {!loading && messages.map((msg, i) => (
          <MessageBubble key={msg.id} message={msg} defaultOpen={i === messages.length - 1} />
        ))}
      </div>

      <div className="border-t border-gray-200 px-6 py-3 flex gap-2">
        <button
          onClick={() => onReply(thread)}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors font-medium"
        >
          Reply
        </button>
      </div>
    </div>
  )
}

function MessageBubble({ message, defaultOpen }: { message: MailMessage; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  const fromLabel = message.from.name
    ? `${message.from.name} <${message.from.email}>`
    : message.from.email

  const date = message.receivedAt.toLocaleString()

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 text-left"
      >
        <div>
          <span className={`text-sm ${!message.isRead ? 'font-semibold' : 'text-gray-700'}`}>
            {fromLabel}
          </span>
          {!open && (
            <span className="text-xs text-gray-400 ml-3 truncate max-w-xs inline-block align-middle">
              {message.bodyText?.slice(0, 80) ?? ''}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 ml-4">{date}</span>
      </button>

      {open && (
        <div className="px-6 pb-4">
          <div className="text-xs text-gray-400 mb-3">
            To: {message.to.map((a) => a.name ?? a.email).join(', ')}
            {message.cc.length > 0 && ` · CC: ${message.cc.map((a) => a.name ?? a.email).join(', ')}`}
          </div>
          {message.bodyHtml ? (
            <iframe
              srcDoc={message.bodyHtml}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="w-full min-h-[200px] border-0"
              onLoad={(e) => {
                const f = e.currentTarget
                f.style.height = `${f.contentDocument?.body?.scrollHeight ?? 200}px`
              }}
            />
          ) : (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
              {message.bodyText}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
