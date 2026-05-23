'use client'

import { useState } from 'react'
import { submitEmail } from '@/lib/actions'

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await submitEmail(new FormData(e.currentTarget))
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-fg-secondary mb-2 uppercase tracking-wide">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-xl border border-border bg-bg-surface text-fg-primary text-sm placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-danger text-xs bg-danger/5 border border-danger/15 rounded-lg px-3 py-2.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
          </svg>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-fg font-semibold py-3 rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Checking…
          </>
        ) : (
          <>
            Continue
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
          </>
        )}
      </button>
    </form>
  )
}
