import Link from 'next/link'
import { listDocuments, createDocument, deleteDocument } from '@/lib/actions'

export const dynamic = 'force-dynamic'

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default async function Home() {
  const docs = await listDocuments()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Foundry Docs</h1>
            <p className="text-gray-500 text-sm">Word processor</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">Documents</h2>
            <form action={createDocument}>
              <button
                type="submit"
                className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
              >
                New document
              </button>
            </form>
          </div>

          {docs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8" data-testid="empty-state">No documents yet. Create your first one.</p>
          ) : (
            <ul className="divide-y divide-gray-100" data-testid="doc-list">
              {docs.map((doc) => {
                const deleteWithId = deleteDocument.bind(null, doc.id)
                return (
                  <li key={doc.id} className="flex items-center group" data-testid="doc-row">
                    <Link
                      href={`/editor/${doc.id}`}
                      className="flex-1 flex items-center justify-between py-3 px-1 hover:bg-gray-50 rounded-l transition-colors"
                    >
                      <span className="font-medium text-gray-800 group-hover:text-blue-600 truncate" data-testid="doc-title-link">
                        {doc.title || 'Untitled'}
                      </span>
                      <span className="text-xs text-gray-400 ml-4 shrink-0">
                        {formatDate(doc.updated_at)}
                      </span>
                    </Link>
                    <form action={deleteWithId} className="shrink-0 ml-2">
                      <button
                        type="submit"
                        aria-label="Delete document"
                        data-testid="delete-doc"
                        className="text-gray-300 hover:text-red-500 px-2 py-3 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          if (!confirm('Delete this document?')) e.preventDefault()
                        }}
                      >
                        ✕
                      </button>
                    </form>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
