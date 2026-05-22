'use client'

import { useState } from 'react'

type Action = (formData: FormData) => Promise<{ error: string } | void>

export function TotpForm({ action, buttonLabel }: { action: Action; buttonLabel: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = await action(fd)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">6-digit code</label>
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
          placeholder="123 456"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
      >
        {loading ? 'Verifying…' : buttonLabel}
      </button>
    </form>
  )
}
