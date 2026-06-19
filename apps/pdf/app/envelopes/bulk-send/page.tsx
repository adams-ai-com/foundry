'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Template {
  id: string
  name: string
  page_count: number
  recipients: Array<{ name: string; email: string }>
  created_at: string
}

interface ParsedRow { name: string; email: string; valid: boolean; error?: string }

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []

  let startIdx = 0
  const first = lines[0].toLowerCase()
  if (first.includes('name') && first.includes('email')) startIdx = 1

  const seen = new Set<string>()
  return lines.slice(startIdx).map(line => {
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''))
    const name = parts[0] || ''
    const email = parts[1] || ''
    if (!name || !email) return { name, email, valid: false, error: 'Missing name or email' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { name, email, valid: false, error: 'Invalid email' }
    if (seen.has(email.toLowerCase())) return { name, email, valid: false, error: 'Duplicate email' }
    seen.add(email.toLowerCase())
    return { name, email, valid: true }
  })
}

export default function BulkSendPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // Step 2
  const [csvText, setCsvText] = useState('')
  const [parsed, setParsed] = useState<ParsedRow[]>([])

  // Step 3
  const [titlePrefix, setTitlePrefix] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/pdf/api/envelope-templates')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setTemplates(d.templates); setLoadingTemplates(false) })
      .catch(() => setLoadingTemplates(false))
  }, [])

  useEffect(() => {
    setParsed(csvText.trim() ? parseCSV(csvText) : [])
  }, [csvText])

  const validRows = parsed.filter(r => r.valid)
  const invalidRows = parsed.filter(r => !r.valid)

  const handleSelectTemplate = useCallback((t: Template) => {
    setSelectedTemplate(t)
    setTitlePrefix(t.name)
    setStep(2)
  }, [])

  async function handleCreate() {
    if (!selectedTemplate || !validRows.length) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/pdf/api/envelopes/bulk-sends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          title_prefix: titlePrefix.trim() || selectedTemplate.name,
          csv_text: csvText,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create bulk send')
      router.push(`/envelopes/bulk-sends/${data.bulk_id}`)
    } catch (e: any) {
      setSubmitError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.push('/envelopes')}
          className="text-xs text-fg-tertiary hover:text-fg-secondary mb-1 flex items-center gap-1">
          ← Envelopes
        </button>
        <h1 className="text-lg font-semibold text-fg-primary">Bulk send</h1>
        <p className="text-sm text-fg-tertiary mt-0.5">
          Send the same document to many recipients. No emails are sent until you review and confirm.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8 text-xs">
        {(['Select template', 'Upload recipients', 'Confirm'] as const).map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-border" />}
            <div className={`flex items-center gap-1.5 ${step === i + 1 ? 'text-accent font-medium' : step > i + 1 ? 'text-fg-secondary' : 'text-fg-tertiary'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold border
                ${step === i + 1 ? 'bg-accent text-white border-accent' : step > i + 1 ? 'bg-bg-hover border-border text-fg-secondary' : 'border-border text-fg-tertiary'}`}>
                {i + 1}
              </div>
              <span className="hidden sm:inline">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Template selection */}
      {step === 1 && (
        <div>
          {loadingTemplates && (
            <div className="text-sm text-fg-tertiary">Loading templates…</div>
          )}
          {!loadingTemplates && templates.length === 0 && (
            <div className="bg-bg-raised border border-border rounded-xl p-8 text-center">
              <p className="text-sm text-fg-secondary mb-2">No templates yet</p>
              <p className="text-xs text-fg-tertiary">
                Create an envelope and save it as a template first.
              </p>
              <button onClick={() => router.push('/envelopes/templates')}
                className="mt-4 text-sm text-accent hover:underline">
                Go to Templates →
              </button>
            </div>
          )}
          {!loadingTemplates && templates.length > 0 && (
            <div className="bg-bg-raised border border-border rounded-xl overflow-hidden">
              <div className="divide-y divide-border">
                {templates.map(t => (
                  <button key={t.id} onClick={() => handleSelectTemplate(t)}
                    className="w-full text-left px-5 py-4 hover:bg-bg-hover transition-colors flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-fg-primary">{t.name}</div>
                      <div className="text-xs text-fg-tertiary mt-0.5">
                        {t.page_count} page{t.page_count !== 1 ? 's' : ''} ·{' '}
                        {Array.isArray(t.recipients) ? t.recipients.length : 0} recipient slot{Array.isArray(t.recipients) && t.recipients.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <svg className="shrink-0 text-fg-tertiary" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: CSV input */}
      {step === 2 && selectedTemplate && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <button onClick={() => setStep(1)} className="text-xs text-fg-tertiary hover:text-fg-secondary">
              ← {selectedTemplate.name}
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-fg-primary mb-2">
              Paste CSV (name, email — one per line)
            </label>
            <div className="text-xs text-fg-tertiary mb-2">
              First line can be a header row (name,email) — it will be skipped automatically.
            </div>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              className="w-full h-40 px-3 py-2 text-sm font-mono bg-bg-raised border border-border rounded-lg
                         text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent resize-y"
              placeholder={"name,email\nJane Smith,jane@example.com\nBob Jones,bob@example.com"}
            />
          </div>

          {parsed.length > 0 && (
            <div className="mb-4">
              {/* Summary */}
              <div className="flex items-center gap-3 mb-3 text-sm">
                <span className="text-green-600 font-medium">{validRows.length} valid</span>
                {invalidRows.length > 0 && (
                  <span className="text-danger font-medium">{invalidRows.length} skipped</span>
                )}
                {validRows.length > 100 && (
                  <span className="text-amber-600 font-medium">Max 100 — first 100 will be used</span>
                )}
              </div>

              {/* Preview table — first 10 */}
              {validRows.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden text-xs">
                  <div className="bg-bg-hover px-3 py-2 grid grid-cols-2 gap-4 font-medium text-fg-secondary border-b border-border">
                    <div>Name</div>
                    <div>Email</div>
                  </div>
                  {validRows.slice(0, 10).map((r, i) => (
                    <div key={i} className="px-3 py-2 grid grid-cols-2 gap-4 border-b border-border last:border-0">
                      <div className="text-fg-primary truncate">{r.name}</div>
                      <div className="text-fg-secondary truncate">{r.email}</div>
                    </div>
                  ))}
                  {validRows.length > 10 && (
                    <div className="px-3 py-2 text-fg-tertiary text-center">
                      +{validRows.length - 10} more
                    </div>
                  )}
                </div>
              )}

              {/* Errors */}
              {invalidRows.length > 0 && (
                <div className="mt-2 text-xs text-danger space-y-0.5">
                  {invalidRows.slice(0, 5).map((r, i) => (
                    <div key={i}>{r.error}: "{r.name}" {r.email}</div>
                  ))}
                  {invalidRows.length > 5 && <div>+{invalidRows.length - 5} more skipped</div>}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setStep(1)}
              className="text-sm text-fg-secondary border border-border px-4 py-2 rounded-lg hover:bg-bg-hover transition-colors">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={validRows.length === 0}
              className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40">
              Next → {validRows.length > 0 ? `${Math.min(validRows.length, 100)} recipients` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && selectedTemplate && (
        <div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-fg-primary mb-1.5">
              Envelope title prefix
            </label>
            <input
              type="text"
              value={titlePrefix}
              onChange={e => setTitlePrefix(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-raised border border-border rounded-lg
                         text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder={selectedTemplate.name}
            />
            <p className="text-xs text-fg-tertiary mt-1.5">
              Each envelope will be titled &ldquo;{(titlePrefix || selectedTemplate.name).trim()} — [Recipient Name]&rdquo;
            </p>
          </div>

          {/* Summary card */}
          <div className="bg-bg-raised border border-border rounded-xl p-5 mb-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-fg-secondary">Template</span>
              <span className="text-fg-primary font-medium">{selectedTemplate.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-secondary">Recipients</span>
              <span className="text-fg-primary font-medium">{Math.min(validRows.length, 100)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-secondary">Envelopes to create</span>
              <span className="text-fg-primary font-medium">{Math.min(validRows.length, 100)}</span>
            </div>
            {validRows.length > 50 && (
              <div className="text-xs text-amber-600 border-t border-border pt-3">
                Note: Guardian allows up to 50 email sends/day. Sending will span multiple days if you exceed this limit.
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
            <p className="text-xs text-blue-700">
              <strong>No emails will be sent yet.</strong> Clicking &ldquo;Create envelopes&rdquo; only creates the draft
              envelopes. You&apos;ll review the list and explicitly trigger sending on the next page.
            </p>
          </div>

          {submitError && (
            <div className="text-sm text-danger mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setStep(2)}
              className="text-sm text-fg-secondary border border-border px-4 py-2 rounded-lg hover:bg-bg-hover transition-colors">
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !titlePrefix.trim()}
              className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40">
              {submitting
                ? 'Creating…'
                : `Create ${Math.min(validRows.length, 100)} envelopes`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
