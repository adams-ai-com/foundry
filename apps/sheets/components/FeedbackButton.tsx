'use client'

import { useRef, useState } from 'react'
import { submitCR } from '@/lib/cr-actions'

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      await submitCR(fd)
      setDone(true)
      formRef.current?.reset()
      setTimeout(() => { setDone(false); setOpen(false) }, 1800)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Submit feedback"
        className="fixed bottom-6 right-6 z-50 w-11 h-11 bg-accent hover:bg-accent-hover text-accent-fg rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M7 8h10M7 12h6m-6 4h10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative bg-bg-raised border border-border rounded-2xl shadow-card w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-fg-primary">Submit feedback</h2>
              <button onClick={() => setOpen(false)} className="text-fg-tertiary hover:text-fg-primary text-xl leading-none transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {done ? (
              <div className="py-6 text-center">
                <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-fg-secondary font-medium">Feedback submitted — thanks!</p>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-fg-secondary mb-1 block">Title *</label>
                  <input
                    name="title"
                    type="text"
                    required
                    placeholder="Short summary of the issue or idea"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-bg-surface text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-fg-secondary mb-1 block">Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Steps to reproduce, expected vs actual, or your idea in detail…"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-bg-surface text-fg-primary placeholder:text-fg-tertiary resize-y focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-fg-secondary mb-1 block">Your name</label>
                  <input
                    name="submitted_by"
                    type="text"
                    placeholder="Optional"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-bg-surface text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-fg-secondary mb-1 block">Attachment</label>
                  <input
                    name="attachment"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                    className="text-xs text-fg-secondary file:mr-3 file:py-1 file:px-3 file:border file:border-border file:rounded-lg file:text-xs file:bg-bg-surface file:text-fg-primary file:cursor-pointer"
                  />
                  <p className="text-xs text-fg-tertiary mt-1">PNG, JPEG, GIF, WebP or PDF · max 11 MB</p>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-accent hover:bg-accent-hover disabled:opacity-60 text-accent-fg text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {submitting ? 'Submitting…' : 'Submit feedback'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
