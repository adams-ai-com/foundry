'use client'

import { useState } from 'react'

type Action = (fd: FormData) => Promise<{ error: string } | void>

export function TotpForm({ action, buttonLabel }: { action: Action; buttonLabel: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await action(new FormData(e.currentTarget))
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="code" className="block text-xs font-semibold text-fg-secondary mb-2 uppercase tracking-wide">
          6-digit code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          autoComplete="one-time-code"
          placeholder="000 000"
          className="w-full px-4 py-4 rounded-xl border-2 border-border bg-bg-surface text-fg-primary text-2xl text-center tracking-[0.5em] font-mono placeholder:text-fg-tertiary placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-0 focus:border-accent transition-all"
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
            Verifying…
          </>
        ) : buttonLabel}
      </button>
    </form>
  )
}
