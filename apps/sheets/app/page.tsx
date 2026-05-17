import Link from 'next/link'
import { listSpreadsheets, createSpreadsheet, deleteSpreadsheet } from '@/lib/actions'

export const dynamic = 'force-dynamic'

function formatDate(ts: string): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60_000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 1)   return 'Just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  if (diffHours < 24) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)   return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function GridIcon() {
  return (
    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" strokeLinecap="round" />
    </svg>
  )
}

function DeleteButton({ id }: { id: string }) {
  const del = deleteSpreadsheet.bind(null, id)
  return (
    <form action={del}>
      <button
        type="submit"
        aria-label="Delete spreadsheet"
        className="text-gray-300 hover:text-red-500 px-2 py-3 transition-colors opacity-0 group-hover:opacity-100"
        onClick={(e) => { if (!confirm('Delete this spreadsheet?')) e.preventDefault() }}
      >
        ✕
      </button>
    </form>
  )
}

export default async function Home() {
  const sheets = await listSpreadsheets()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-semibold text-gray-900">Foundry Sheets</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/change-requests" className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors">
            Change Requests
          </Link>
          <form action={createSpreadsheet}>
            <button type="submit" className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium">
              + New spreadsheet
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent spreadsheets</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {sheets.length === 0 ? (
            <div className="py-16 text-center" data-testid="empty-state">
              <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="1" />
                  <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium mb-1">No spreadsheets yet</p>
              <p className="text-gray-400 text-sm">Click &ldquo;+ New spreadsheet&rdquo; to get started.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100" data-testid="sheet-list">
              {sheets.map(s => (
                <li key={s.id} className="flex items-center group" data-testid="sheet-row">
                  <Link
                    href={`/editor/${s.id}`}
                    className="flex-1 flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GridIcon />
                      <span className="font-medium text-gray-800 group-hover:text-emerald-700 truncate transition-colors">
                        {s.title || 'Untitled'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 ml-6 shrink-0 tabular-nums">{formatDate(s.updated_at)}</span>
                  </Link>
                  <DeleteButton id={s.id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
