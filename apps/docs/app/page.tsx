import Link from 'next/link'

export default function Home() {
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
            <Link
              href="/editor/new"
              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
            >
              New document
            </Link>
          </div>
          <p className="text-gray-400 text-sm text-center py-8">No documents yet. Create your first one.</p>
        </div>
      </div>
    </main>
  )
}
