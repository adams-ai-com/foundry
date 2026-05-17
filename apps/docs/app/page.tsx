import Link from 'next/link'
import { listDocuments } from '@/lib/actions'
import { createDocument } from '@/lib/actions'

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
            <p className="text-gray-400 text-sm text-center py-8">No documents yet. Create your first one.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/editor/${doc.id}`}
                    className="flex items-center justify-between py-3 px-1 hover:bg-gray-50 rounded transition-colors group"
                  >
                    <span className="font-medium text-gray-800 group-hover:text-blue-600 truncate">
                      {doc.title || 'Untitled'}
                    </span>
                    <span className="text-xs text-gray-400 ml-4 shrink-0">
                      {formatDate(doc.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
