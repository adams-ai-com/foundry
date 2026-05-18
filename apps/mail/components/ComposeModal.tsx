'use client'

import { useState } from 'react'
import type { MailThread } from '@foundry/shared'
import { sendMail } from '../lib/api'

const FROM_ADDRESS = process.env.NEXT_PUBLIC_MAIL_FROM ?? ''

interface ComposeModalProps {
  onClose: () => void
  replyTo?: MailThread
}

export function ComposeModal({ onClose, replyTo }: ComposeModalProps) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState(
    replyTo ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : ''
  )
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      setError('To and Subject are required')
      return
    }
    setSending(true)
    setError(null)
    try {
      await sendMail({
        from: FROM_ADDRESS,
        to: to.trim(),
        subject: subject.trim(),
        bodyText: body,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 w-[480px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-700 rounded-t-xl">
        <span className="text-white text-sm font-medium">
          {replyTo ? 'Reply' : 'New message'}
        </span>
        <button onClick={onClose} className="text-gray-300 hover:text-white text-lg leading-none">×</button>
      </div>

      <div className="border-b border-gray-200 px-4 py-2">
        <input
          placeholder="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-full text-sm outline-none"
          disabled={sending}
        />
      </div>
      <div className="border-b border-gray-200 px-4 py-2">
        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full text-sm outline-none"
          disabled={sending}
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="flex-1 px-4 py-3 text-sm outline-none resize-none min-h-[200px]"
        placeholder="Compose email"
        disabled={sending}
      />

      {error && (
        <div className="px-4 pb-2 text-xs text-red-600">{error}</div>
      )}

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
        <button
          className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
          onClick={handleSend}
          disabled={sending}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
          Discard
        </button>
      </div>
    </div>
  )
}
