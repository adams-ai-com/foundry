import Link from 'next/link'
import { listDocuments, createDocument } from '@/lib/actions'
import { DeleteButton } from '@/components/DeleteButton'

export const dynamic = 'force-dynamic'

function formatDate(ts: string): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function Home() {
  const docs = await listDocuments()

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Recent documents
        </h2>
        <div className="flex items-center gap-3">
          <Link href="/change-requests" className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors">
            Change Requests
          </Link>
          <form action={createDocument}>
            <button
              type="submit"
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + New document
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {docs.length === 0 ? (
          <div className="py-16 text-center" data-testid="empty-state">
            <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl text-gray-300">📄</span>
            </div>
            <p className="text-gray-500 font-medium mb-1">No documents yet</p>
            <p className="text-gray-400 text-sm">Click &ldquo;+ New document&rdquo; to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100" data-testid="doc-list">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center group" data-testid="doc-row">
                <Link
                  href={`/editor/${doc.id}`}
                  className="flex-1 flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-gray-300 shrink-0 text-sm">📄</span>
                    <span
                      className="font-medium text-gray-800 group-hover:text-blue-600 truncate transition-colors"
                      data-testid="doc-title-link"
                    >
                      {doc.title || 'Untitled'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 ml-6 shrink-0 tabular-nums">
                    {formatDate(doc.updated_at)}
                  </span>
                </Link>
                <DeleteButton docId={doc.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
