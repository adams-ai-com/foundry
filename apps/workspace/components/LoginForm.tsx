'use client'

import { useState } from 'react'
import { login, registerFirstAdmin } from '@/lib/actions'

const inputCls =
  'w-full px-4 py-3 rounded-xl border border-border bg-bg-surface text-fg-primary text-sm placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all'
const labelCls = 'block text-xs font-semibold text-fg-secondary mb-2 uppercase tracking-wide'

export function LoginForm({ firstRun = false }: { firstRun?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = firstRun ? await registerFirstAdmin(fd) : await login(fd)
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {firstRun && (
        <div>
          <label htmlFor="name" className={labelCls}>Your name</label>
          <input id="name" name="name" type="text" autoFocus placeholder="Ada Lovelace" className={inputCls} />
        </div>
      )}

      <div>
        <label htmlFor="email" className={labelCls}>Email address</label>
        <input id="email" name="email" type="email" required autoFocus={!firstRun}
          placeholder="you@example.com" className={inputCls} />
      </div>

      <div>
        <label htmlFor="password" className={labelCls}>Password</label>
        <input id="password" name="password" type="password" required
          autoComplete={firstRun ? 'new-password' : 'current-password'}
          minLength={firstRun ? 10 : undefined}
          placeholder={firstRun ? 'At least 10 characters' : '••••••••'} className={inputCls} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-danger text-xs bg-danger/5 border border-danger/15 rounded-lg px-3 py-2.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
          </svg>
          {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-fg font-semibold py-3 rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2">
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {firstRun ? 'Creating…' : 'Signing in…'}
          </>
        ) : (
          <>
            {firstRun ? 'Create admin account' : 'Sign in'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
          </>
        )}
      </button>
    </form>
  )
}
