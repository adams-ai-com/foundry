'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type EnvelopeStatus = 'sent' | 'partial' | 'complete' | 'voided'

interface Envelope {
  id: string
  title: string
  status: EnvelopeStatus
  page_count: number
  created_at: string
  expires_at: string | null
  completed_at: string | null
  total_recipients: string
  signed_recipients: string
  bulk_send_id: string | null
}

const STATUS_LABEL: Record<EnvelopeStatus, string> = {
  sent: 'Awaiting',
  partial: 'In progress',
  complete: 'Complete',
  voided: 'Voided',
}

const STATUS_COLOR: Record<EnvelopeStatus, string> = {
  sent: 'text-amber-700 bg-amber-100',
  partial: 'text-blue-700 bg-blue-100',
  complete: 'text-green-700 bg-green-100',
  voided: 'text-gray-500 bg-gray-100',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000)
  if (d < 0) return 'Expired'
  if (d === 0) return 'Expires today'
  if (d === 1) return 'Expires tomorrow'
  return `Expires in ${d}d`
}

export default function EnvelopesPage() {
  const router = useRouter()
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/pdf/api/envelopes')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setEnvelopes(d.envelopes); setLoading(false) })
      .catch(() => { setError('Failed to load envelopes'); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="animate-pulse text-fg-tertiary text-sm">Loading…</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <p className="text-sm text-danger">{error}</p>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/')}
            className="text-xs text-fg-tertiary hover:text-fg-secondary mb-1 flex items-center gap-1">
            ← Documents
          </button>
          <h1 className="text-lg font-semibold text-fg-primary">Envelopes</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/envelopes/branding')}
            className="text-sm text-fg-secondary border border-border px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
          >
            Branding
          </button>
          <button
            onClick={() => router.push('/envelopes/bulk-send')}
            className="text-sm text-fg-secondary border border-border px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
          >
            Bulk send
          </button>
          <button
            onClick={() => router.push('/envelopes/templates')}
            className="text-sm text-fg-secondary border border-border px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
          >
            Templates
          </button>
          <button
            onClick={() => router.push('/')}
            className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            New envelope
          </button>
        </div>
      </div>

      {/* Empty state */}
      {envelopes.length === 0 && (
        <div className="bg-bg-raised border border-border rounded-xl p-12 text-center">
          <p className="text-sm text-fg-secondary mb-1">No envelopes yet</p>
          <p className="text-xs text-fg-tertiary">
            Open a document and choose &ldquo;Send for signing&rdquo; to create one.
          </p>
        </div>
      )}

      {/* List */}
      {envelopes.length > 0 && (
        <div className="bg-bg-raised border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {envelopes.map(env => {
              const total = parseInt(env.total_recipients, 10) || 0
              const signed = parseInt(env.signed_recipients, 10) || 0
              const pct = total ? (signed / total) * 100 : 0

              return (
                <button
                  key={env.id}
                  onClick={() => router.push(`/envelopes/${env.id}`)}
                  className="w-full text-left px-5 py-4 hover:bg-bg-hover transition-colors flex items-center gap-4"
                >
                  {/* Icon */}
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center text-fg-tertiary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="9" y1="15" x2="15" y2="15"/>
                      <line x1="12" y1="12" x2="12" y2="18"/>
                    </svg>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-fg-primary truncate">{env.title}</span>
                      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[env.status]}`}>
                        {STATUS_LABEL[env.status]}
                      </span>
                      {env.bulk_send_id && (
                        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full text-purple-700 bg-purple-100">
                          Bulk
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-fg-tertiary">
                      <span>{fmt(env.created_at)}</span>
                      {env.status === 'complete' && env.completed_at && (
                        <span className="text-green-600">Completed {fmt(env.completed_at)}</span>
                      )}
                      {(env.status === 'sent' || env.status === 'partial') && env.expires_at && (
                        <span className={new Date(env.expires_at) < new Date() ? 'text-danger' : ''}>
                          {daysUntil(env.expires_at)}
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {env.status !== 'voided' && total > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-bg-hover overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-fg-tertiary tabular-nums shrink-0">
                          {signed}/{total}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg className="shrink-0 text-fg-tertiary" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Count footer */}
      {envelopes.length > 0 && (
        <p className="text-xs text-fg-tertiary text-center mt-4">
          {envelopes.length} envelope{envelopes.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
