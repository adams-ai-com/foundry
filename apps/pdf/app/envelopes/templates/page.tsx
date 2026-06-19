'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface TemplateRecipient {
  name: string; email: string; order_index: number; required: boolean; color: string
}
interface TemplateField {
  recipient_index: number; page: number; field_type: string
  x0: number; y0: number; x1: number; y1: number; required: boolean
}
interface Template {
  id: string
  name: string
  page_count: number
  recipients: TemplateRecipient[]
  fields: TemplateField[]
  created_at: string
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [using, setUsing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/pdf/api/envelope-templates')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setTemplates(d.templates); setLoading(false) })
      .catch(() => { setError('Failed to load templates'); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  async function useTemplate(id: string) {
    setUsing(id)
    try {
      const res = await fetch(`/pdf/api/envelope-templates/${id}/use`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Failed to use template'); return }
      router.push(`/editor/${data.job_id}?template=${id}`)
    } finally {
      setUsing(null)
    }
  }

  async function deleteTemplate(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/pdf/api/envelope-templates/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id))
        setConfirmDelete(null)
      } else {
        const data = await res.json()
        alert(data.error ?? 'Failed to delete template')
      }
    } finally {
      setDeleting(null)
    }
  }

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
          <button onClick={() => router.push('/envelopes')}
            className="text-xs text-fg-tertiary hover:text-fg-secondary mb-1 flex items-center gap-1">
            ← Envelopes
          </button>
          <h1 className="text-lg font-semibold text-fg-primary">Templates</h1>
        </div>
      </div>

      {/* Empty state */}
      {templates.length === 0 && (
        <div className="bg-bg-raised border border-border rounded-xl p-12 text-center">
          <p className="text-sm text-fg-secondary mb-1">No templates yet</p>
          <p className="text-xs text-fg-tertiary">
            Open a document, set up signers and fields, then choose
            &ldquo;Save as template&rdquo; in the Review step.
          </p>
        </div>
      )}

      {/* List */}
      {templates.length > 0 && (
        <div className="bg-bg-raised border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {templates.map(tmpl => {
              const recipCount = tmpl.recipients?.length ?? 0
              const fieldCount = tmpl.fields?.length ?? 0

              return (
                <div key={tmpl.id}
                  className="px-5 py-4 flex items-center gap-4">
                  {/* Icon */}
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center text-fg-tertiary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <line x1="9" y1="9" x2="15" y2="9"/>
                      <line x1="9" y1="13" x2="15" y2="13"/>
                      <line x1="9" y1="17" x2="12" y2="17"/>
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg-primary truncate">{tmpl.name}</p>
                    <p className="text-xs text-fg-tertiary mt-0.5">
                      {recipCount} signer{recipCount !== 1 ? 's' : ''}
                      {' · '}
                      {fieldCount} field{fieldCount !== 1 ? 's' : ''}
                      {' · '}
                      {fmt(tmpl.created_at)}
                    </p>
                    {/* Recipient preview */}
                    {recipCount > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {tmpl.recipients.map((r, i) => (
                          <span key={i}
                            className="inline-flex items-center gap-1 text-xs bg-bg-hover border border-border rounded-full px-2 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color ?? '#6b7280' }} />
                            <span className="text-fg-secondary truncate max-w-[120px]">{r.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {confirmDelete === tmpl.id ? (
                      <>
                        <span className="text-xs text-fg-tertiary">Delete?</span>
                        <button
                          onClick={() => deleteTemplate(tmpl.id)}
                          disabled={deleting === tmpl.id}
                          className="text-xs text-danger border border-danger/30 rounded-lg px-3 py-1.5 hover:bg-danger/10 disabled:opacity-40">
                          {deleting === tmpl.id ? '…' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-fg-tertiary border border-border rounded-lg px-3 py-1.5 hover:bg-bg-hover">
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmDelete(tmpl.id)}
                          className="text-xs text-fg-tertiary hover:text-danger p-1.5 rounded hover:bg-bg-hover"
                          title="Delete template">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => useTemplate(tmpl.id)}
                          disabled={using === tmpl.id}
                          className="text-xs font-medium bg-accent text-accent-fg rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-40">
                          {using === tmpl.id ? 'Opening…' : 'Use template'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <p className="text-xs text-fg-tertiary text-center mt-4">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
