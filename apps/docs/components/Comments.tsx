'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Comment = {
  id: string
  content: string
  resolved: boolean
  created_at: string
}

interface Props {
  documentId: string
  onClose: () => void
}

function formatDate(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function Comments({ documentId, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/docs/api/comments/${documentId}`)
    const data = await res.json()
    setComments(data)
    setLoading(false)
  }, [documentId])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setSubmitting(true)
    await fetch(`/docs/api/comments/${documentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input.trim() }),
    })
    setInput('')
    setSubmitting(false)
    load()
  }

  async function handleResolve(c: Comment) {
    setActioning(c.id)
    await fetch(`/docs/api/comments/${documentId}/resolve/${c.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c.resolved ? { reopen: true } : {}),
    })
    setActioning(null)
    load()
  }

  const open = comments.filter((c) => !c.resolved)
  const resolved = comments.filter((c) => c.resolved)

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col" role="dialog" aria-label="Comments">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">Comments</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label="Close">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <>
            {open.length === 0 && resolved.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No comments yet.</div>
            )}

            {open.length > 0 && (
              <ul className="divide-y divide-gray-50">
                {open.map((c) => (
                  <li key={c.id} className="px-4 py-3 group">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap mb-1">{c.content}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                      <button
                        onClick={() => handleResolve(c)}
                        disabled={actioning === c.id}
                        className="text-xs text-green-600 hover:text-green-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      >
                        {actioning === c.id ? 'Saving…' : 'Resolve'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {resolved.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-t border-gray-100">
                  Resolved
                </div>
                <ul className="divide-y divide-gray-50">
                  {resolved.map((c) => (
                    <li key={c.id} className="px-4 py-3 group opacity-60 hover:opacity-100 transition-opacity">
                      <p className="text-sm text-gray-600 whitespace-pre-wrap mb-1 line-through decoration-gray-300">{c.content}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                        <button
                          onClick={() => handleResolve(c)}
                          disabled={actioning === c.id}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                        >
                          {actioning === c.id ? 'Saving…' : 'Reopen'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        <form onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent)
            }}
            placeholder="Add a comment…"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={submitting || !input.trim()}
              className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
