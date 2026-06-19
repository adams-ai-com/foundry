'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'

interface BulkSend {
  id: string
  template_id: string
  template_name: string
  title_prefix: string
  status: 'ready' | 'sending' | 'complete' | 'error'
  total_count: number
  sent_count: number
  created_at: string
}

interface EnvelopeRow {
  id: string
  title: string
  status: string
  recipient_name: string
  recipient_email: string
  recipient_status: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Invited',
  partial: 'In progress',
  complete: 'Complete',
  voided: 'Voided',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'text-fg-tertiary bg-bg-hover',
  sent: 'text-amber-700 bg-amber-100',
  partial: 'text-blue-700 bg-blue-100',
  complete: 'text-green-700 bg-green-100',
  voided: 'text-gray-500 bg-gray-100',
}

const BULK_STATUS_LABEL: Record<string, string> = {
  ready: 'Ready to send',
  sending: 'Sending…',
  complete: 'Complete',
  error: 'Error',
}

const BULK_STATUS_COLOR: Record<string, string> = {
  ready: 'text-amber-700 bg-amber-100',
  sending: 'text-blue-700 bg-blue-100',
  complete: 'text-green-700 bg-green-100',
  error: 'text-red-700 bg-red-100',
}

export default function BulkSendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [bulk, setBulk] = useState<BulkSend | null>(null)
  const [envelopes, setEnvelopes] = useState<EnvelopeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/pdf/api/envelopes/bulk-sends/${id}`)
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      setBulk(data.bulk)
      setEnvelopes(data.envelopes)
      setLoading(false)
    } catch {
      setError('Failed to load bulk send')
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Poll while sending
  useEffect(() => {
    if (!bulk || (bulk.status !== 'sending')) return
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [bulk, fetchStatus])

  async function handleSend() {
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(`/pdf/api/envelopes/bulk-sends/${id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start sending')
      setShowConfirm(false)
      fetchStatus()
    } catch (e: any) {
      setSendError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="animate-pulse text-fg-tertiary text-sm">Loading…</div>
    </div>
  )

  if (error || !bulk) return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <p className="text-sm text-danger">{error ?? 'Not found'}</p>
    </div>
  )

  const pct = bulk.total_count ? Math.round((bulk.sent_count / bulk.total_count) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Confirm send modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-bg-raised border border-border rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-fg-primary mb-2">Send {bulk.total_count} invitations?</h2>
            <p className="text-sm text-fg-secondary mb-4">
              This will send signing invitation emails to <strong>{bulk.total_count} people</strong>{' '}
              at a rate of 10 per minute. Once started, it cannot be stopped.
            </p>
            {bulk.total_count > 50 && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                Guardian allows up to 50 sends/day. Remaining envelopes will queue and complete the next day.
              </div>
            )}
            {sendError && (
              <div className="text-sm text-danger mb-4">{sendError}</div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={sending}
                className="text-sm text-fg-secondary border border-border px-4 py-2 rounded-lg hover:bg-bg-hover transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="text-sm font-medium bg-red-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40">
                {sending ? 'Starting…' : `Send ${bulk.total_count} invitations`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.push('/envelopes')}
            className="text-xs text-fg-tertiary hover:text-fg-secondary mb-1 flex items-center gap-1">
            ← Envelopes
          </button>
          <h1 className="text-lg font-semibold text-fg-primary">{bulk.title_prefix}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BULK_STATUS_COLOR[bulk.status]}`}>
              {BULK_STATUS_LABEL[bulk.status]}
            </span>
            <span className="text-xs text-fg-tertiary">Template: {bulk.template_name}</span>
          </div>
        </div>

        {bulk.status === 'ready' && (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
            Send to {bulk.total_count} recipients
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="bg-bg-raised border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-fg-secondary">Progress</span>
          <span className="text-fg-primary font-medium tabular-nums">
            {bulk.sent_count} / {bulk.total_count} sent
          </span>
        </div>
        <div className="h-2 rounded-full bg-bg-hover overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {bulk.status === 'sending' && (
          <p className="text-xs text-fg-tertiary mt-2">
            Sending at 10/minute · {bulk.total_count - bulk.sent_count} remaining
          </p>
        )}
        {bulk.status === 'ready' && (
          <p className="text-xs text-fg-tertiary mt-2">
            {bulk.total_count} draft envelope{bulk.total_count !== 1 ? 's' : ''} ready — no emails sent yet
          </p>
        )}
        {bulk.status === 'complete' && (
          <p className="text-xs text-green-600 mt-2">All invitations sent</p>
        )}
        {bulk.status === 'error' && (
          <p className="text-xs text-danger mt-2">
            An error occurred during sending. {bulk.sent_count} of {bulk.total_count} were sent.
          </p>
        )}
      </div>

      {/* Envelope list */}
      <div className="bg-bg-raised border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-bg-hover">
          <span className="text-xs font-medium text-fg-secondary">Recipients</span>
        </div>

        {envelopes.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-fg-tertiary">No envelopes</div>
        )}

        <div className="divide-y divide-border">
          {envelopes.map(env => (
            <div key={env.id}
              className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-fg-primary font-medium truncate">{env.recipient_name}</div>
                <div className="text-xs text-fg-tertiary truncate">{env.recipient_email}</div>
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[env.status] ?? 'text-fg-tertiary bg-bg-hover'}`}>
                {STATUS_LABEL[env.status] ?? env.status}
              </span>
              {env.status !== 'draft' && (
                <button
                  onClick={() => router.push(`/envelopes/${env.id}`)}
                  className="shrink-0 text-xs text-fg-tertiary hover:text-fg-secondary">
                  View →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-fg-tertiary text-center mt-4">
        {envelopes.length} envelope{envelopes.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
