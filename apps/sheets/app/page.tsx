import Link from 'next/link'
import { listSpreadsheets, createSpreadsheet } from '@/lib/actions'
import { DeleteButton } from '@/components/DeleteButton'

export const dynamic = 'force-dynamic'

function formatDate(ts: string): string {
  const date = new Date(ts)
  const now  = new Date()
  const diffMs    = now.getTime() - date.getTime()
  const diffMins  = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays  = Math.floor(diffHours / 24)
  if (diffMins  < 1)   return 'Just now'
  if (diffMins  < 60)  return `${diffMins}m ago`
  if (diffHours < 24)  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays  === 1) return 'Yesterday'
  if (diffDays  < 7)   return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SheetIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18M3 15h18M9 3v18"/>
    </svg>
  )
}
function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

export default async function Home() {
  const sheets = await listSpreadsheets()

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-10">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg-primary">Spreadsheets</h1>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="text-sm text-fg-tertiary">
              {sheets.length === 0
                ? 'No spreadsheets yet'
                : `${sheets.length} spreadsheet${sheets.length === 1 ? '' : 's'}`}
            </span>
            <span className="text-fg-tertiary/40">·</span>
            <Link
              href="/change-requests"
              className="text-sm text-fg-tertiary hover:text-accent transition-colors"
            >
              Change requests
            </Link>
          </div>
        </div>

        <form action={createSpreadsheet}>
          <button
            type="submit"
            className="flex items-center gap-1.5 bg-accent text-accent-fg text-sm px-4 py-2
                       rounded-lg hover:bg-accent-h transition-colors font-medium"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New spreadsheet
          </button>
        </form>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {sheets.length === 0 && (
        <div className="rounded-2xl border border-border bg-bg-surface py-20 flex flex-col items-center"
             data-testid="empty-state">
          <div className="w-12 h-12 rounded-xl bg-bg-raised border border-border
                         flex items-center justify-center mb-4">
            <SheetIcon className="w-5 h-5 text-accent/50" />
          </div>
          <p className="text-fg-primary font-semibold text-sm mb-1">No spreadsheets yet</p>
          <p className="text-fg-tertiary text-xs mb-6">Create your first spreadsheet to get started.</p>
          <form action={createSpreadsheet}>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-accent text-accent-fg text-sm px-4 py-2
                         rounded-lg hover:bg-accent-h transition-colors font-medium"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              New spreadsheet
            </button>
          </form>
        </div>
      )}

      {/* ── Spreadsheet list ──────────────────────────────────────────────── */}
      {sheets.length > 0 && (
        <div className="rounded-2xl border border-border bg-bg-raised overflow-hidden shadow-card">
          <ul className="divide-y divide-border" data-testid="sheet-list">
            {sheets.map(s => (
              <li key={s.id} className="flex items-center group" data-testid="sheet-row">
                <Link
                  href={`/editor/${s.id}`}
                  className="flex-1 flex items-center gap-3.5 px-5 py-3.5
                             hover:bg-bg-hover transition-colors min-w-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border flex-shrink-0
                                 flex items-center justify-center
                                 group-hover:bg-accent/10 group-hover:border-accent/20 transition-all duration-150">
                    <SheetIcon className="w-4 h-4 text-accent/50 group-hover:text-accent transition-colors duration-150" />
                  </div>
                  <span
                    className="flex-1 font-medium text-fg-primary text-sm truncate
                               group-hover:text-accent transition-colors"
                    data-testid="sheet-title-link"
                  >
                    {s.title || 'Untitled'}
                  </span>
                  <span className="text-xs text-fg-tertiary ml-4 shrink-0 tabular-nums">
                    {formatDate(s.updated_at)}
                  </span>
                </Link>
                <DeleteButton id={s.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}
