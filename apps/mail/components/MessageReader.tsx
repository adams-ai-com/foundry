'use client'

import { useEffect, useState } from 'react'
import type { MailThread, MailMessage } from '@foundry/shared'
import type { ComposeRequest } from './ComposeModal'
import { getThread } from '../lib/api'

interface MessageReaderProps {
  thread: MailThread | null
  onCompose: (req?: ComposeRequest) => void
}

export function MessageReader({ thread, onCompose }: MessageReaderProps) {
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
      <div className="flex-1 flex items-center justify-center text-fg-tertiary text-sm bg-bg-base">
        Select a message to read
      </div>
    )
  }

  const lastMessage = messages[messages.length - 1]

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-base">
      <div className="px-6 py-4 border-b border-border flex-shrink-0 bg-bg-raised">
        <h1 className="text-lg font-semibold text-fg-primary">{thread.subject}</h1>
        <div className="text-sm text-fg-secondary mt-1">
          {thread.participants.map((p) => p.name ?? p.email).join(', ')}
          {' · '}
          {thread.messageCount} {thread.messageCount === 1 ? 'message' : 'messages'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12 text-fg-tertiary text-sm">
            Loading…
          </div>
        )}
        {!loading && messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            defaultOpen={i === messages.length - 1}
            onForward={() => onCompose({ forwardMessage: msg })}
          />
        ))}
      </div>

      <div className="border-t border-border px-6 py-3 flex gap-2 flex-shrink-0 bg-bg-raised">
        <button
          onClick={() => onCompose({ replyTo: thread })}
          className="text-sm bg-bg-hover hover:bg-bg-active text-fg-primary px-3 py-1.5 rounded-lg transition-colors font-medium border border-border"
        >
          Reply
        </button>
        {thread.participants.length > 1 && (
          <button
            onClick={() => onCompose({ replyTo: thread, replyAll: true })}
            className="text-sm bg-bg-hover hover:bg-bg-active text-fg-primary px-3 py-1.5 rounded-lg transition-colors font-medium border border-border"
          >
            Reply All
          </button>
        )}
        {lastMessage && (
          <button
            onClick={() => onCompose({ forwardMessage: lastMessage })}
            className="text-sm bg-bg-hover hover:bg-bg-active text-fg-primary px-3 py-1.5 rounded-lg transition-colors font-medium border border-border"
          >
            Forward
          </button>
        )}
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  defaultOpen,
  onForward,
}: {
  message: MailMessage
  defaultOpen: boolean
  onForward: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)

  const fromLabel = message.from.name
    ? `${message.from.name} <${message.from.email}>`
    : message.from.email

  const date = message.receivedAt.toLocaleString()

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-3 hover:bg-bg-hover text-left transition-colors"
      >
        <div>
          <span className={`text-sm ${!message.isRead ? 'font-semibold text-fg-primary' : 'text-fg-secondary'}`}>
            {fromLabel}
          </span>
          {!open && (
            <span className="text-xs text-fg-tertiary ml-3 truncate max-w-xs inline-block align-middle">
              {message.bodyText?.slice(0, 80) ?? ''}
            </span>
          )}
        </div>
        <span className="text-xs text-fg-tertiary flex-shrink-0 ml-4">{date}</span>
      </button>

      {open && (
        <div className="px-6 pb-4">
          <div className="text-xs text-fg-tertiary mb-3">
            To: {message.to.map((a) => a.name ?? a.email).join(', ')}
            {message.cc.length > 0 &&
              ` · CC: ${message.cc.map((a) => a.name ?? a.email).join(', ')}`}
          </div>
          {message.bodyHtml ? (
            <iframe
              srcDoc={message.bodyHtml}
              sandbox="allow-popups"
              className="w-full min-h-[200px] border-0 rounded-lg"
              onLoad={(e) => {
                const f = e.currentTarget
                f.style.height = `${f.contentDocument?.body?.scrollHeight ?? 200}px`
              }}
            />
          ) : (
            <pre className="text-sm text-fg-secondary whitespace-pre-wrap font-sans">
              {message.bodyText}
            </pre>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={onForward}
              className="text-xs text-fg-secondary hover:text-fg-primary hover:bg-bg-hover px-2 py-1 rounded-lg transition-colors border border-border"
            >
              Forward
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
