import { redirect } from 'next/navigation'
import { verifyMagicLink } from '@/lib/actions'

export const dynamic = 'force-dynamic'

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (!token) redirect('/login')

  const error = await verifyMagicLink(token)
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Link {error.error.toLowerCase().includes('expir') ? 'expired' : 'invalid'}</h2>
          <p className="text-gray-500 text-sm mb-6">{error.error}</p>
          <a href="/login" className="text-indigo-600 text-sm hover:underline">Request a new link →</a>
        </div>
      </div>
    )
  }

  redirect('/')
}
