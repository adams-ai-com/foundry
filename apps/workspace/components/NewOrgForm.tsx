'use client'

import { useState } from 'react'
import { createOrg } from '@/lib/actions'

export function NewOrgForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await createOrg(new FormData(e.currentTarget))
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="name" className="block text-xs font-medium text-fg-secondary mb-1.5">Organization name</label>
        <input
          id="name" name="name" type="text" required autoFocus
          placeholder="Acme Corp"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-bg-surface text-fg-primary text-sm placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
        />
      </div>
      {error && <p className="text-danger text-xs">⚠ {error}</p>}
      <button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-fg font-medium py-2.5 rounded-lg text-sm transition-all duration-150">
        {loading ? 'Creating…' : 'Create workspace'}
      </button>
    </form>
  )
}
