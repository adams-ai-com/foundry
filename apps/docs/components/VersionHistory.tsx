'use client'

import { useCallback, useEffect, useState } from 'react'

type Version = {
  id: string
  title: string
  content_hash: string
  label: string | null
  created_at: string
}

interface Props {
  documentId: string
  currentTitle: string
  onClose: () => void
  onRestore: (content: object, title: string) => void
  onSaveNamed: (label: string) => Promise<void>
}

function formatDate(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function VersionHistory({ documentId, onClose, onRestore, onSaveNamed }: Props) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [naming, setNaming] = useState(false)
  const [labelInput, setLabelInput] = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/docs/api/versions/${documentId}`)
    const data = await res.json()
    setVersions(data)
    setLoading(false)
  }, [documentId])

  useEffect(() => { load() }, [load])

  async function handleSaveNamed(e: React.FormEvent) {
    e.preventDefault()
    if (!labelInput.trim()) return
    await onSaveNamed(labelInput.trim())
    setLabelInput('')
    setNaming(false)
    load()
  }

  async function handleRestore(v: Version) {
    setRestoring(v.id)
    const res = await fetch(`/docs/api/versions/${documentId}/restore/${v.id}`, { method: 'POST' })
    const data = await res.json()
    if (data.content) onRestore(data.content, data.title)
    setRestoring(null)
    onClose()
  }

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col" role="dialog" aria-label="Version history">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">Version history</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label="Close">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 border-b border-gray-100">
        {naming ? (
          <form onSubmit={handleSaveNamed} className="flex gap-2">
            <input
              autoFocus
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Version name…"
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button type="submit" className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700">Save</button>
            <button type="button" onClick={() => setNaming(false)} className="text-sm text-gray-400 hover:text-gray-700">Cancel</button>
          </form>
        ) : (
          <button
            onClick={() => setNaming(true)}
            className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium text-left"
          >
            + Name this version
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : versions.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No versions yet. Versions are saved automatically as you edit.</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {versions.map((v) => (
              <li key={v.id} className="px-4 py-3 hover:bg-gray-50 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {v.label && <p className="text-sm font-medium text-gray-900 truncate">{v.label}</p>}
                    <p className="text-xs text-gray-400">{formatDate(v.created_at)}</p>
                    <p className="text-xs text-gray-500 truncate">{v.title}</p>
                  </div>
                  <button
                    onClick={() => handleRestore(v)}
                    disabled={restoring === v.id}
                    className="shrink-0 text-xs text-indigo-600 hover:text-indigo-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    {restoring === v.id ? 'Restoring…' : 'Restore'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
