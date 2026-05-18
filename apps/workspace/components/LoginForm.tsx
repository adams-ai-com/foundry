'use client'

import { useState } from 'react'
import { requestMagicLink } from '@/lib/actions'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = await requestMagicLink(fd)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      const email = fd.get('email') as string
      router.push(`/login?sent=${encodeURIComponent(email)}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          placeholder="you@example.com"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
      >
        {loading ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>
  )
}
