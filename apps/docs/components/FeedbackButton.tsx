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
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        title="Submit feedback"
        className="fixed bottom-6 right-6 z-50 w-11 h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M7 8h10M7 12h6m-6 4h10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Submit feedback</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {done ? (
              <div className="py-6 text-center">
                <div className="text-3xl mb-2">✓</div>
                <p className="text-sm text-gray-600 font-medium">Feedback submitted — thanks!</p>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Title *</label>
                  <input
                    name="title"
                    type="text"
                    required
                    placeholder="Short summary of the issue or idea"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Steps to reproduce, expected vs actual, or your idea in detail…"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Your name</label>
                  <input
                    name="submitted_by"
                    type="text"
                    placeholder="Optional"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Attachment</label>
                  <input
                    name="attachment"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                    className="text-xs text-gray-500 file:mr-3 file:py-1 file:px-3 file:border file:border-gray-200 file:rounded-lg file:text-xs file:bg-white file:cursor-pointer"
                  />
                  <p className="text-xs text-gray-400 mt-1">PNG, JPEG, GIF, WebP or PDF · max 11 MB</p>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
