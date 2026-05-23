'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  token: string
  email: string
  defaultName: string
}

export function AcceptForm({ token, email, defaultName }: Props) {
  const [name, setName] = useState(defaultName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function join() {
    if (!name.trim() || loading) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/connect/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.trim() }),
      })
      const data = await res.json() as { ok?: boolean; channelId?: string; topicId?: string; error?: string }
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.replace(`/connect/${data.channelId}/${data.topicId}`)
    } catch {
      setError('Failed to join. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <div className="mb-4">
        <label className="block text-xs font-medium text-fg-secondary mb-1.5">Email</label>
        <div className="px-3 py-2 bg-bg-raised border border-border rounded-lg text-sm text-fg-tertiary">
          {email}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-medium text-fg-secondary mb-1.5">
          Display name
        </label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && join()}
          placeholder="Your name"
          className="w-full px-3 py-2 bg-bg-raised border border-border rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {error && <p className="text-danger text-xs mb-4">{error}</p>}

      <button
        onClick={join}
        disabled={!name.trim() || loading}
        className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-accent-fg text-sm font-medium rounded-xl transition-colors"
      >
        {loading ? 'Joining…' : 'Join conversation'}
      </button>

      <p className="text-[10px] text-fg-tertiary text-center mt-4">
        You&apos;ll only have access to the topics you were invited to.
      </p>
    </div>
  )
}
