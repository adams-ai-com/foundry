'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

type RecipientStatus = 'pending' | 'active' | 'signed' | 'declined' | 'voided'
type EnvelopeStatus = 'sent' | 'partial' | 'complete' | 'voided'

interface Recipient {
  id: string; name: string; email: string
  order_index: number; status: RecipientStatus
  signed_at: string | null; viewed_at: string | null
  signing_url: string | null
}

interface Envelope {
  id: string; title: string; status: EnvelopeStatus
  page_count: number; created_at: string
  expires_at: string | null; completed_at: string | null
}

interface Event {
  event: string; actor: string | null
  detail: Record<string, unknown>; created_at: string
}

const STATUS_LABEL: Record<RecipientStatus, string> = {
  pending: 'Awaiting invitation', active: 'Action needed', signed: 'Signed',
  declined: 'Declined', voided: 'Voided',
}
const STATUS_COLOR: Record<RecipientStatus, string> = {
  pending: 'text-gray-500 bg-gray-100',
  active: 'text-amber-700 bg-amber-100',
  signed: 'text-green-700 bg-green-100',
  declined: 'text-red-700 bg-red-100',
  voided: 'text-gray-400 bg-gray-100',
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export default function EnvelopePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [envelope, setEnvelope] = useState<Envelope | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [resending, setResending] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/pdf/api/envelopes/${id}`)
    if (!res.ok) { setError('Envelope not found'); return }
    const data = await res.json()
    setEnvelope(data.envelope)
    setRecipients(data.recipients)
    setEvents(data.events)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    // Auto-refresh every 15s while not complete
    const t = setInterval(() => {
      if (envelope?.status === 'complete' || envelope?.status === 'voided') return
      load()
    }, 15_000)
    return () => clearInterval(t)
  }, [load, envelope?.status])

  async function copyLink(url: string, recipId: string) {
    await navigator.clipboard.writeText(url)
    setCopied(recipId)
    setTimeout(() => setCopied(null), 2000)
  }

  async function resendLink(recipId: string) {
    setResending(recipId)
    const res = await fetch(`/pdf/api/envelopes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: recipId }),
    })
    if (res.ok) { await load() }
    setResending(null)
  }

  async function voidEnvelope() {
    if (!confirm('Void this envelope? Signers will no longer be able to sign.')) return
    setVoiding(true)
    await fetch(`/pdf/api/envelopes/${id}`, { method: 'DELETE' })
    await load()
    setVoiding(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="animate-pulse text-fg-tertiary text-sm">Loading…</div>
    </div>
  )
  if (error || !envelope) return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <p className="text-sm text-fg-tertiary">{error ?? 'Not found'}</p>
    </div>
  )

  const signed = recipients.filter(r => r.status === 'signed').length
  const total = recipients.filter(r => r.status !== 'voided').length
  const progress = total ? (signed / total) * 100 : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back */}
      <button onClick={() => router.push('/pdf')}
        className="flex items-center gap-1.5 text-xs text-fg-tertiary hover:text-fg-secondary mb-6">
        ← Back to documents
      </button>

      {/* Header */}
      <div className="bg-bg-raised border border-border rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-fg-primary truncate">{envelope.title}</h1>
            <p className="text-xs text-fg-tertiary mt-0.5">
              Created {timeAgo(envelope.created_at)}
              {envelope.expires_at && ` · Expires ${new Date(envelope.expires_at).toLocaleDateString()}`}
            </p>
          </div>
          <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
            { sent: 'text-amber-700 bg-amber-100', partial: 'text-blue-700 bg-blue-100',
              complete: 'text-green-700 bg-green-100', voided: 'text-gray-500 bg-gray-100' }[envelope.status]
          }`}>
            {{ sent: 'Awaiting signatures', partial: 'In progress', complete: 'Complete', voided: 'Voided' }[envelope.status]}
          </span>
        </div>

        {/* Progress bar */}
        {envelope.status !== 'voided' && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-fg-tertiary mb-1">
              <span>{signed} of {total} signed</span>
              {envelope.status === 'complete' && envelope.completed_at && (
                <span>Completed {timeAgo(envelope.completed_at)}</span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Actions */}
        {envelope.status !== 'voided' && envelope.status !== 'complete' && (
          <div className="mt-4 flex gap-2">
            <button onClick={voidEnvelope} disabled={voiding}
              className="text-xs text-danger border border-danger/30 rounded-lg px-3 py-1.5 hover:bg-danger/5 disabled:opacity-40">
              {voiding ? 'Voiding…' : 'Void envelope'}
            </button>
          </div>
        )}
      </div>

      {/* Recipients — grouped by signing step */}
      <div className="bg-bg-raised border border-border rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Signers</h2>
        </div>
        {(() => {
          const sortedRecips = [...recipients].sort((a, b) => a.order_index - b.order_index)
          const uniqueSteps = [...new Set(sortedRecips.map(r => r.order_index))]
          const multiStep = uniqueSteps.length > 1
          return uniqueSteps.map((stepOrd, si) => {
            const stepRecips = sortedRecips.filter(r => r.order_index === stepOrd)
            const allSigned = stepRecips.every(r => r.status === 'signed')
            const anyActive = stepRecips.some(r => r.status === 'active')
            const allPending = stepRecips.every(r => r.status === 'pending')
            const stepLabel = allSigned ? 'Complete' : anyActive ? 'In progress' : allPending ? 'Waiting' : ''
            const stepLabelColor = allSigned ? 'text-green-600' : anyActive ? 'text-amber-600' : 'text-fg-tertiary'
            return (
              <div key={stepOrd}>
                {multiStep && (
                  <div className="px-4 py-1.5 bg-bg-base border-b border-border flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wide">
                      Step {si + 1}
                    </span>
                    {stepLabel && (
                      <span className={`text-[10px] font-medium ${stepLabelColor}`}>{stepLabel}</span>
                    )}
                  </div>
                )}
                <div className="divide-y divide-border">
                  {stepRecips.map(r => (
                    <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg-primary truncate">{r.name}</p>
                        <p className="text-xs text-fg-tertiary truncate">{r.email}</p>
                        {r.viewed_at && !r.signed_at && (
                          <p className="text-xs text-fg-tertiary">Viewed {timeAgo(r.viewed_at)}</p>
                        )}
                        {r.signed_at && (
                          <p className="text-xs text-green-600">Signed {timeAgo(r.signed_at)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                        {r.signing_url && r.status === 'active' && (
                          <div className="flex gap-1">
                            <button onClick={() => copyLink(r.signing_url!, r.id)}
                              className="text-xs border border-border rounded px-2 py-1 hover:bg-bg-hover">
                              {copied === r.id ? '✓ Copied' : 'Copy link'}
                            </button>
                            <button onClick={() => resendLink(r.id)} disabled={resending === r.id}
                              className="text-xs border border-border rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-40">
                              {resending === r.id ? '…' : 'Refresh'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        })()}
      </div>

      {/* Audit timeline */}
      <div className="bg-bg-raised border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Activity</h2>
        </div>
        <div className="px-4 py-3 space-y-2">
          {events.map((ev, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-fg-tertiary shrink-0 tabular-nums">{timeAgo(ev.created_at)}</span>
              <span className="text-fg-secondary capitalize">{ev.event.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
