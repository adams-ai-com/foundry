'use client'

import { useState, useEffect } from 'react'
import { listAppPasswords, createAppPassword, deleteAppPassword } from '../lib/api'
import type { AppPassword } from '../lib/api'

function XIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function TrashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
}
function CopyIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
}

interface Props {
  onClose: () => void
}

export function AppPasswordModal({ onClose }: Props) {
  const [passwords, setPasswords] = useState<AppPassword[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const caldavUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'https://foundry.adams-ai.com'

  useEffect(() => {
    listAppPasswords()
      .then((list) => setPasswords(list as AppPassword[]))
      .catch(() => setPasswords([]))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    setCreating(true)
    try {
      const pw = await createAppPassword(label.trim())
      setNewToken(pw.token)
      setLabel('')
      const list = await listAppPasswords()
      setPasswords(list as AppPassword[])
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteAppPassword(id)
    setConfirmDelete(null)
    const list = await listAppPasswords()
    setPasswords(list as AppPassword[])
  }

  const copyToken = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const inputClass = 'bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors'
  const labelClass = 'block text-xs font-medium text-fg-secondary mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-bg-base border border-border rounded-xl shadow-card w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-semibold text-sm text-fg-primary">CalDAV Sync</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">Connect iOS, macOS, or any CalDAV client</p>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover transition-colors">
            <XIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Setup instructions */}
          <div className="bg-bg-surface rounded-lg p-4 border border-border text-xs text-fg-secondary space-y-1.5">
            <p className="font-semibold text-fg-primary text-xs mb-2">Setup instructions</p>
            <p><span className="font-medium">iOS:</span> Settings → Calendar → Accounts → Add Account → Other → Add CalDAV Account</p>
            <p><span className="font-medium">macOS:</span> Calendar → Settings → Accounts → + → Other CalDAV</p>
            <div className="mt-2 pt-2 border-t border-border space-y-1">
              <p><span className="font-medium text-fg-primary">Server:</span> <code className="bg-bg-raised px-1.5 py-0.5 rounded font-mono text-xs">{caldavUrl}</code></p>
              <p><span className="font-medium text-fg-primary">Username:</span> your account email</p>
              <p><span className="font-medium text-fg-primary">Password:</span> use an app password (create one below)</p>
            </div>
          </div>

          {/* New token reveal */}
          {newToken && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
              <p className="text-xs font-semibold text-accent mb-2">App password created — copy it now, it won't be shown again</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-bg-base font-mono text-xs px-3 py-2 rounded-lg border border-border text-fg-primary break-all">
                  {newToken}
                </code>
                <button
                  onClick={copyToken}
                  className="flex-shrink-0 p-2 rounded-lg bg-accent text-accent-fg hover:bg-accent-hover transition-colors"
                  title="Copy"
                >
                  {copied ? <span className="text-xs font-medium px-0.5">Copied!</span> : <CopyIcon />}
                </button>
              </div>
              <button onClick={() => setNewToken(null)} className="mt-2 text-xs text-fg-tertiary hover:text-fg-secondary transition-colors">
                Dismiss
              </button>
            </div>
          )}

          {/* Create form */}
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-fg-primary">Create app password</p>
            <div>
              <label className={labelClass}>Label (e.g. "iPhone", "MacBook")</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Device name"
                className={inputClass + ' w-full'}
                required
              />
            </div>
            <button
              type="submit"
              disabled={creating || !label.trim()}
              className="self-start bg-accent hover:bg-accent-hover text-accent-fg font-medium text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create password'}
            </button>
          </form>

          {/* Existing passwords */}
          <div>
            <p className="text-xs font-semibold text-fg-primary mb-2">Active passwords</p>
            {loading ? (
              <p className="text-xs text-fg-tertiary">Loading…</p>
            ) : passwords.length === 0 ? (
              <p className="text-xs text-fg-tertiary">No app passwords yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {passwords.map((pw) => (
                  <div key={pw.id} className="flex items-center justify-between bg-bg-surface rounded-lg px-3 py-2.5 border border-border">
                    <div>
                      <p className="text-xs font-medium text-fg-primary">{pw.label}</p>
                      <p className="text-xs text-fg-tertiary">
                        Created {new Date(pw.createdAt).toLocaleDateString()}
                        {pw.lastUsedAt ? ` · Last used ${new Date(pw.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                      </p>
                    </div>
                    {confirmDelete === pw.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-danger">Delete?</span>
                        <button onClick={() => handleDelete(pw.id)} className="text-xs font-medium text-danger hover:underline">Yes</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs text-fg-secondary hover:underline">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(pw.id)}
                        className="text-fg-tertiary hover:text-danger transition-colors p-1 rounded"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
