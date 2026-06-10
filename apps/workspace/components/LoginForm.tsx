'use client'

import { useState } from 'react'
import { submitEmail } from '@/lib/actions'

const MS_ERRORS: Record<string, string> = {
  auth_failed: 'Microsoft sign-in failed. Please try again.',
  domain_not_allowed: 'Your Microsoft account domain is not permitted.',
  account_deactivated: 'This account has been deactivated. Contact your administrator.',
  ms_not_configured: 'Microsoft sign-in is not configured.',
  access_cancelled: 'Sign-in was cancelled.',
}

export function LoginForm({ urlError }: { urlError?: string | null }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    urlError ? (MS_ERRORS[urlError] ?? 'Sign-in failed. Please try again.') : null
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await submitEmail(new FormData(e.currentTarget))
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <div className="space-y-4">
      {/* Microsoft SSO button */}
      <a
        href="/api/auth/microsoft/start"
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-bg-surface hover:bg-bg-hover text-fg-primary text-sm font-semibold transition-all duration-150"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none">
          <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
          <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
          <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
          <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
        </svg>
        Sign in with Microsoft
      </a>

      <div className="flex items-center gap-3 text-xs text-fg-tertiary">
        <div className="flex-1 border-t border-border" />
        <span>or use email</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Email + continue form */}
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
    </div>
  )
}
