import Link from 'next/link'
import { listSites, createSite } from '@/lib/actions'

export const dynamic = 'force-dynamic'

function SitesIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
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
function UsersIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}

function formatDate(ts: string): string {
  const date = new Date(ts)
  const now   = new Date()
  const diffMs    = now.getTime() - date.getTime()
  const diffMins  = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays  = Math.floor(diffMs / 86_400_000)
  if (diffMins  < 1)   return 'Just now'
  if (diffMins  < 60)  return `${diffMins}m ago`
  if (diffHours < 24)  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays  === 1) return 'Yesterday'
  if (diffDays  < 7)   return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function SitesHome() {
  const sites = await listSites()

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg-primary">Sites</h1>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="text-sm text-fg-tertiary">
              {sites.length === 0
                ? 'No sites yet'
                : `${sites.length} site${sites.length === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        <form action={createSite} className="flex items-center gap-2">
          <input
            type="text"
            name="name"
            required
            placeholder="Site name…"
            className="text-sm px-3 py-2 bg-bg-surface border border-border rounded-lg
                       text-fg-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10
                       transition-all placeholder:text-fg-tertiary/60 w-44"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 bg-accent text-accent-fg text-sm px-4 py-2
                       rounded-lg hover:bg-accent-hover transition-colors font-medium flex-shrink-0"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New site
          </button>
        </form>
      </div>

      {/* Empty state */}
      {sites.length === 0 && (
        <div className="rounded-2xl border border-border bg-bg-surface py-20 flex flex-col items-center"
             data-testid="empty-state">
          <div className="w-12 h-12 rounded-xl bg-bg-raised border border-border
                         flex items-center justify-center mb-4">
            <SitesIcon className="w-5 h-5 text-accent/50" />
          </div>
          <p className="text-fg-primary font-semibold text-sm mb-1">No sites yet</p>
          <p className="text-fg-tertiary text-xs mb-6 text-center max-w-xs">
            Create a site to organize content in folders with member-level permissions.
          </p>
        </div>
      )}

      {/* Site list */}
      {sites.length > 0 && (
        <div className="rounded-2xl border border-border bg-bg-raised overflow-hidden shadow-card">
          <ul className="divide-y divide-border">
            {sites.map(s => (
              <li key={s.id} className="flex items-center group">
                <Link
                  href={`/${s.slug}`}
                  className="flex-1 flex items-center gap-3.5 px-5 py-3.5
                             hover:bg-bg-hover transition-colors min-w-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border flex-shrink-0
                                 flex items-center justify-center
                                 group-hover:bg-accent/10 group-hover:border-accent/20 transition-all duration-150">
                    <SitesIcon className="w-4 h-4 text-accent/50 group-hover:text-accent transition-colors duration-150" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-fg-primary text-sm group-hover:text-accent transition-colors overflow-hidden text-ellipsis whitespace-nowrap">
                      {s.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-fg-tertiary">{s.folderCount} folder{s.folderCount !== 1 ? 's' : ''}</span>
                      <span className="text-fg-tertiary/40 text-xs">·</span>
                      <span className="text-xs text-fg-tertiary">{s.pageCount} page{s.pageCount !== 1 ? 's' : ''}</span>
                      {s.memberCount > 0 && (
                        <>
                          <span className="text-fg-tertiary/40 text-xs">·</span>
                          <span className="flex items-center gap-1 text-xs text-fg-tertiary">
                            <UsersIcon className="w-3 h-3" />
                            {s.memberCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-fg-tertiary ml-4 shrink-0 tabular-nums">
                    {formatDate(s.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
