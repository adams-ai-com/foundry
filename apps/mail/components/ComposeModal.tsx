'use client'

import { useState, useEffect, useRef } from 'react'
import type { MailThread, MailMessage } from '@foundry/shared'
import { sendMail, uploadFile, type FileItem } from '../lib/api'
import { RecipientInput, type Recipient } from './RecipientInput'
import { RichTextEditor, type RichTextEditorRef } from './RichTextEditor'

const DEFAULT_FROM = process.env.NEXT_PUBLIC_MAIL_FROM ?? ''
const DRAFT_KEY = 'foundry-mail-draft-new'

export interface ComposeRequest {
  replyTo?: MailThread
  replyAll?: boolean
  forwardMessage?: MailMessage
  to?: string
  subject?: string
  fromAddress?: string
  fromAccountId?: string
}

function recipientsToApi(rs: Recipient[]): { name?: string; email: string }[] {
  return rs.map((r) => ({ email: r.email, ...(r.name ? { name: r.name } : {}) }))
}

function threadReplyRecipients(thread: MailThread, replyAll: boolean): Recipient[] {
  const others = thread.participants.filter((p) => p.email !== FROM_ADDRESS)
  return (replyAll ? others : others.slice(0, 1)).map((p) => ({
    email: p.email,
    name: p.name ?? undefined,
  }))
}

function buildForwardHtml(msg: MailMessage): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const fromLabel = msg.from.name
    ? `${esc(msg.from.name)} &lt;${esc(msg.from.email)}&gt;`
    : esc(msg.from.email)
  const toLabel = msg.to.map((a) => esc(a.name ?? a.email)).join(', ')
  const body =
    msg.bodyHtml ?? `<p style="white-space:pre-wrap">${esc(msg.bodyText ?? '')}</p>`
  return [
    '<p></p>',
    '<div style="border-left:3px solid #d1d5db;padding-left:12px;color:#6b7280;font-size:13px;margin-top:16px">',
    `<p><strong>From:</strong> ${fromLabel}</p>`,
    `<p><strong>Date:</strong> ${esc(msg.receivedAt.toLocaleString())}</p>`,
    `<p><strong>To:</strong> ${toLabel}</p>`,
    `<p><strong>Subject:</strong> ${esc(msg.subject ?? '')}</p>`,
    '</div>',
    `<blockquote style="border-left:3px solid #d1d5db;padding-left:12px;margin:8px 0">${body}</blockquote>`,
  ].join('')
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

interface ComposeModalProps {
  onClose: () => void
  request?: ComposeRequest
  fromOptions?: { email: string; displayName: string; accountId: string }[]
}

export function ComposeModal({ onClose, request, fromOptions }: ComposeModalProps) {
  const replyTo = request?.replyTo
  const forwardMessage = request?.forwardMessage
  const isNewMessage = !replyTo && !forwardMessage

  const initFromAddress = request?.fromAddress ?? DEFAULT_FROM
  const initFromAccountId = request?.fromAccountId ?? fromOptions?.[0]?.accountId ?? ''

  const initTo: Recipient[] = replyTo
    ? threadReplyRecipients(replyTo, request?.replyAll ?? false)
    : request?.to
    ? [{ email: request.to }]
    : []

  const initSubject =
    request?.subject ??
    (forwardMessage
      ? forwardMessage.subject?.startsWith('Fwd:')
        ? forwardMessage.subject
        : `Fwd: ${forwardMessage.subject ?? ''}`
      : replyTo
      ? replyTo.subject.startsWith('Re:')
        ? replyTo.subject
        : `Re: ${replyTo.subject}`
      : '')

  const [fromAddress, setFromAddress] = useState(initFromAddress)
  const [fromAccountId, setFromAccountId] = useState(initFromAccountId)
  const [to, setTo] = useState<Recipient[]>(initTo)
  const [cc, setCc] = useState<Recipient[]>([])
  const [bcc, setBcc] = useState<Recipient[]>([])
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [subject, setSubject] = useState(initSubject)
  const [bodyHtml, setBodyHtml] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [attachments, setAttachments] = useState<FileItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<RichTextEditorRef>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore draft on mount (new messages only)
  useEffect(() => {
    if (!isNewMessage) return
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (!saved) return
      const d = JSON.parse(saved)
      if (d.to?.length) setTo(d.to)
      if (d.cc?.length) { setCc(d.cc); setShowCc(true) }
      if (d.subject) setSubject(d.subject)
      if (d.body) editorRef.current?.setContent(d.body)
    } catch { /* ignore */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft (new messages only, 2s debounce)
  useEffect(() => {
    if (!isNewMessage) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      if (to.length > 0 || subject || bodyText) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ to, cc, subject, body: bodyHtml }))
        setDraftSaved(true)
        setTimeout(() => setDraftSaved(false), 2000)
      }
    }, 2000)
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current) }
  }, [to, cc, subject, bodyHtml, bodyText, isNewMessage])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(files.map((f) => uploadFile(f)))
      setAttachments((prev) => [...prev, ...uploaded])
    } catch {
      setError('File upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSend = async () => {
    if (!to.length || !subject.trim()) {
      setError('To and Subject are required')
      return
    }
    setSending(true)
    setError(null)
    try {
      await sendMail({
        from: fromAddress || DEFAULT_FROM,
        to: recipientsToApi(to),
        cc: cc.length ? recipientsToApi(cc) : undefined,
        bcc: bcc.length ? recipientsToApi(bcc) : undefined,
        subject: subject.trim(),
        bodyText,
        bodyHtml: bodyHtml || undefined,
        inReplyTo: replyTo?.id,
        threadId: replyTo?.id,
        attachmentIds: attachments.map((a) => a.id),
        _accountId: fromAccountId || undefined,
      })
      if (isNewMessage) localStorage.removeItem(DRAFT_KEY)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const handleDiscard = () => {
    if (isNewMessage) localStorage.removeItem(DRAFT_KEY)
    onClose()
  }

  const title = forwardMessage
    ? 'Forward'
    : replyTo
    ? request?.replyAll
      ? 'Reply All'
      : 'Reply'
    : 'New message'

  return (
    <div className="fixed bottom-4 right-4 w-[520px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50 max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-700 rounded-t-xl flex-shrink-0">
        <span className="text-white text-sm font-medium">{title}</span>
        <div className="flex items-center gap-3">
          {draftSaved && <span className="text-xs text-gray-400">Draft saved</span>}
          <button onClick={handleDiscard} className="text-gray-300 hover:text-white text-lg leading-none">
            ×
          </button>
        </div>
      </div>

      {/* From — only shown when multiple accounts are available */}
      {fromOptions && fromOptions.length > 1 && (
        <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400 flex-shrink-0 w-10">From</span>
          <select
            value={fromAccountId}
            onChange={(e) => {
              const opt = fromOptions.find((o) => o.accountId === e.target.value)
              if (opt) { setFromAccountId(opt.accountId); setFromAddress(opt.email) }
            }}
            disabled={sending}
            className="flex-1 text-sm outline-none bg-transparent text-gray-700"
          >
            {fromOptions.map((o) => (
              <option key={o.accountId} value={o.accountId}>{o.email}</option>
            ))}
          </select>
        </div>
      )}

      {/* To */}
      <div className="border-b border-gray-200 px-4 py-2 flex items-start gap-2 flex-shrink-0">
        <span className="text-xs text-gray-400 pt-1 flex-shrink-0 w-6">To</span>
        <div className="flex-1 min-w-0">
          <RecipientInput
            recipients={to}
            onChange={setTo}
            placeholder="To"
            disabled={sending}
          />
        </div>
        <div className="flex gap-2 flex-shrink-0 pt-0.5">
          {!showCc && (
            <button
              type="button"
              onClick={() => setShowCc(true)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cc
            </button>
          )}
          {!showBcc && (
            <button
              type="button"
              onClick={() => setShowBcc(true)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Bcc
            </button>
          )}
        </div>
      </div>

      {/* Cc */}
      {showCc && (
        <div className="border-b border-gray-200 px-4 py-2 flex items-start gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400 pt-1 flex-shrink-0 w-6">Cc</span>
          <div className="flex-1 min-w-0">
            <RecipientInput
              recipients={cc}
              onChange={setCc}
              placeholder="Cc recipients"
              disabled={sending}
            />
          </div>
        </div>
      )}

      {/* Bcc */}
      {showBcc && (
        <div className="border-b border-gray-200 px-4 py-2 flex items-start gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400 pt-1 flex-shrink-0 w-6">Bcc</span>
          <div className="flex-1 min-w-0">
            <RecipientInput
              recipients={bcc}
              onChange={setBcc}
              placeholder="Bcc recipients"
              disabled={sending}
            />
          </div>
        </div>
      )}

      {/* Subject */}
      <div className="border-b border-gray-200 px-4 py-2 flex-shrink-0">
        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full text-sm outline-none"
          disabled={sending}
        />
      </div>

      {/* Rich text body */}
      <div className="flex-1 overflow-hidden min-h-0">
        <RichTextEditor
          ref={editorRef}
          initialHtml={forwardMessage ? buildForwardHtml(forwardMessage) : ''}
          onChange={(html, text) => {
            setBodyHtml(html)
            setBodyText(text)
          }}
          placeholder="Compose email"
          disabled={sending}
        />
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-1.5 flex-shrink-0">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
            >
              <span className="truncate max-w-[140px]">{a.filename}</span>
              <span className="text-gray-400">({formatBytes(a.size)})</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                disabled={sending}
                className="ml-0.5 hover:text-red-500 text-gray-400 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Error */}
      {error && <div className="px-4 py-1 text-xs text-red-600 flex-shrink-0">{error}</div>}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            onClick={handleSend}
            disabled={sending || uploading}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            title="Attach files"
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50 transition-colors"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          {uploading && <span className="text-xs text-gray-400">Uploading…</span>}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
        <button onClick={handleDiscard} className="text-gray-400 hover:text-gray-600 text-sm">
          Discard
        </button>
      </div>
    </div>
  )
}
