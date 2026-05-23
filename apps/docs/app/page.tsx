import Link from 'next/link'
import { listDocuments, createDocument } from '@/lib/actions'
import { DeleteButton } from '@/components/DeleteButton'

export const dynamic = 'force-dynamic'

function formatDate(ts: string): string {
  const date = new Date(ts)
  const now  = new Date()
  const diffMs    = now.getTime() - date.getTime()
  const diffMins  = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays  = Math.floor(diffMs / 86_400_000)
  if (diffMins  < 1)  return 'Just now'
  if (diffMins  < 60) return `${diffMins}m ago`
  if (diffHours < 24) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays  === 1) return 'Yesterday'
  if (diffDays  < 7)  return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function DocIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
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
  const docs = await listDocuments()

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-10">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg-primary">Documents</h1>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="text-sm text-fg-tertiary">
              {docs.length === 0
                ? 'No documents yet'
                : `${docs.length} document${docs.length === 1 ? '' : 's'}`}
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

        <form action={createDocument}>
          <button
            type="submit"
            className="flex items-center gap-1.5 bg-accent text-accent-fg text-sm px-4 py-2
                       rounded-lg hover:bg-accent-h transition-colors font-medium"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New document
          </button>
        </form>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {docs.length === 0 && (
        <div className="rounded-2xl border border-border bg-bg-surface py-20 flex flex-col items-center"
             data-testid="empty-state">
          <div className="w-12 h-12 rounded-xl bg-bg-raised border border-border
                         flex items-center justify-center mb-4">
            <DocIcon className="w-5 h-5 text-accent/50" />
          </div>
          <p className="text-fg-primary font-semibold text-sm mb-1">No documents yet</p>
          <p className="text-fg-tertiary text-xs mb-6">Create your first document to get started.</p>
          <form action={createDocument}>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-accent text-accent-fg text-sm px-4 py-2
                         rounded-lg hover:bg-accent-h transition-colors font-medium"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              New document
            </button>
          </form>
        </div>
      )}

      {/* ── Document list ─────────────────────────────────────────────────── */}
      {docs.length > 0 && (
        <div className="rounded-2xl border border-border bg-bg-raised overflow-hidden shadow-card">
          <ul className="divide-y divide-border" data-testid="doc-list">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center group" data-testid="doc-row">
                <Link
                  href={`/editor/${doc.id}`}
                  className="flex-1 flex items-center gap-3.5 px-5 py-3.5
                             hover:bg-bg-hover transition-colors min-w-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border flex-shrink-0
                                 flex items-center justify-center
                                 group-hover:bg-accent/10 group-hover:border-accent/20 transition-all duration-150">
                    <DocIcon className="w-4 h-4 text-accent/50 group-hover:text-accent transition-colors duration-150" />
                  </div>
                  <span
                    className="flex-1 font-medium text-fg-primary text-sm truncate
                               group-hover:text-accent transition-colors"
                    data-testid="doc-title-link"
                  >
                    {doc.title || 'Untitled'}
                  </span>
                  <span className="text-xs text-fg-tertiary ml-4 shrink-0 tabular-nums">
                    {formatDate(doc.updated_at)}
                  </span>
                </Link>
                <DeleteButton docId={doc.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}
