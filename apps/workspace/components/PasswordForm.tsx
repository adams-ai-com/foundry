'use client'

import { useState } from 'react'
import { passwordLogin } from '@/lib/actions'

export function PasswordForm({ email }: { email: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await passwordLogin(new FormData(e.currentTarget))
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email chip */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface border border-border">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
             strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-fg-tertiary flex-shrink-0">
          <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        <span className="text-xs text-fg-secondary truncate font-mono">{email}</span>
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-semibold text-fg-secondary mb-2 uppercase tracking-wide">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Enter your password"
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
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
          </>
        )}
      </button>

      <div className="text-center">
        <a href="/login" className="text-xs text-fg-tertiary hover:text-fg-secondary transition-colors">
          ← Use a different email
        </a>
      </div>
    </form>
  )
}
