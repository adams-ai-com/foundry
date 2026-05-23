import { requireAdmin } from '@/lib/auth'
import { getOrgTimezone } from '@/lib/timezone'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const ACTION_LABELS: Record<string, string> = {
  'auth.sign_in':          'Sign in',
  'auth.totp_setup':       'TOTP enrolled',
  'user.invite':           'Invited user',
  'user.deactivate':       'Deactivated user',
  'user.reactivate':       'Reactivated user',
  'user.remove':           'Removed from org',
  'user.totp_reset':       'Reset TOTP',
  'user.role_change':      'Changed role',
  'user.app_access_change':'Updated app access',
  'org.profile_update':    'Updated org profile',
  'org.security_update':   'Updated security policy',
  'org.app_defaults_update':'Updated app defaults',
  'domain.add':            'Added domain',
  'domain.verify':         'Verified domain',
  'domain.remove':         'Removed domain',
  'domain.set_primary':    'Set primary domain',
  'domain.dkim_generate':  'Generated DKIM keys',
  'domain.dmarc_update':   'Updated DMARC policy',
  'group.create':          'Created group',
  'group.update':          'Updated group',
  'group.delete':          'Deleted group',
  'group.member_add':      'Added group member',
  'group.member_remove':     'Removed group member',
  'group.app_access_update': 'Updated group app access',
  'session.force_sign_out':    'Force sign-out',
  'session.force_sign_out_all':'Force sign-out all',
  'mail.smtp_config_update':   'Updated SMTP config',
}

const ACTION_COLORS: Record<string, string> = {
  'auth.sign_in':     'bg-emerald-500/10 text-emerald-600',
  'auth.totp_setup':  'bg-emerald-500/10 text-emerald-600',
  'user.deactivate':  'bg-red-500/10 text-red-600',
  'user.remove':      'bg-red-500/10 text-red-600',
  'user.totp_reset':  'bg-amber-500/10 text-amber-600',
  'user.role_change': 'bg-blue-500/10 text-blue-600',
  'domain.verify':    'bg-emerald-500/10 text-emerald-600',
  'domain.remove':    'bg-red-500/10 text-red-600',
  'group.create':     'bg-blue-500/10 text-blue-600',
  'group.delete':     'bg-red-500/10 text-red-600',
  'group.member_add': 'bg-blue-500/10 text-blue-600',
  'group.member_remove': 'bg-amber-500/10 text-amber-600',
}

const CATEGORIES = [
  { value: '',       label: 'All events' },
  { value: 'auth',   label: 'Auth' },
  { value: 'user',   label: 'Users' },
  { value: 'org',    label: 'Org' },
  { value: 'domain', label: 'Domains' },
  { value: 'group',  label: 'Groups' },
]

type AuditRow = {
  id: string
  actor_email: string
  action: string
  target_email: string | null
  metadata: Record<string, unknown>
  created_at: string
}

function fmtMeta(action: string, meta: Record<string, unknown>): string | null {
  if (action === 'user.role_change') return `${meta.from} → ${meta.to}`
  if (action === 'org.security_update') {
    const parts: string[] = []
    if (meta.requireTotp !== undefined) parts.push(`TOTP ${meta.requireTotp ? 'required' : 'optional'}`)
    if (meta.timeoutHours) parts.push(`${meta.timeoutHours}h session`)
    if (meta.maxSessions) parts.push(`max ${meta.maxSessions} sessions`)
    return parts.join(', ') || null
  }
  if (meta.domain) return String(meta.domain)
  return null
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; page?: string }>
}) {
  const session = await requireAdmin()
  const sp = await searchParams

  const q = (sp.q ?? '').trim()
  const tz = await getOrgTimezone(session.orgId!)
  const cat = sp.cat ?? ''
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const rows = await db`
    SELECT id, actor_email, action, target_email, metadata, created_at
    FROM audit_log
    WHERE org_id = ${session.orgId!}
      ${cat ? db`AND action LIKE ${cat + '.%'}` : db``}
      ${q ? db`AND (actor_email ILIKE ${'%' + q + '%'} OR target_email ILIKE ${'%' + q + '%'} OR action ILIKE ${'%' + q + '%'})` : db``}
    ORDER BY created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  ` as unknown as AuditRow[]

  const countRows = await db`
    SELECT COUNT(*)::int AS n FROM audit_log
    WHERE org_id = ${session.orgId!}
      ${cat ? db`AND action LIKE ${cat + '.%'}` : db``}
      ${q ? db`AND (actor_email ILIKE ${'%' + q + '%'} OR target_email ILIKE ${'%' + q + '%'} OR action ILIKE ${'%' + q + '%'})` : db``}
  ` as unknown as Array<{ n: number }>

  const total = countRows[0]?.n ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildUrl(overrides: Record<string, string | number>) {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (cat) p.set('cat', cat)
    if (page > 1) p.set('page', String(page))
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) p.set(k, String(v)); else p.delete(k)
    })
    const s = p.toString()
    return `/admin/audit${s ? '?' + s : ''}`
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-primary">Audit Log</h1>
        <p className="text-sm text-fg-secondary mt-1">
          All admin actions and sign-in events for this organization.
        </p>
      </div>

      {/* Filters */}
      <form method="GET" action="/admin/audit" className="flex flex-wrap gap-2 mb-5">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by email or action…"
          className="px-3 py-2 text-sm bg-bg-raised border border-border rounded-lg text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 min-w-0 flex-1"
        />
        <select
          name="cat"
          defaultValue={cat}
          className="px-3 py-2 text-sm bg-bg-raised border border-border rounded-lg text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors"
        >
          Search
        </button>
        {(q || cat) && (
          <a
            href="/admin/audit"
            className="px-4 py-2 text-sm font-medium bg-bg-raised hover:bg-bg-hover border border-border text-fg-secondary rounded-lg transition-colors"
          >
            Clear
          </a>
        )}
      </form>

      {/* Export */}
      <div className="flex justify-end mb-3">
        <a
          href={`/admin/audit/export${q || cat ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(cat ? { cat } : {}) })}` : ''}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary border border-border hover:bg-bg-hover px-3 py-1.5 rounded-lg transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export CSV
        </a>
      </div>

      {/* Results summary */}
      <p className="text-xs text-fg-tertiary mb-3">
        {total === 0 ? 'No events found' : `${total.toLocaleString()} event${total === 1 ? '' : 's'}${q || cat ? ' matching filters' : ''}`}
        {totalPages > 1 && ` — page ${page} of ${totalPages}`}
      </p>

      {/* Log table */}
      {rows.length > 0 ? (
        <div className="bg-bg-raised border border-border rounded-xl overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Actor</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Event</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Target / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(row => {
                const color = ACTION_COLORS[row.action] ?? 'bg-fg-tertiary/10 text-fg-tertiary'
                const label = ACTION_LABELS[row.action] ?? row.action
                const detail = fmtMeta(row.action, row.metadata)
                return (
                  <tr key={row.id} className="hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-3 text-xs text-fg-tertiary whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString('en-US', {
                        timeZone: tz,
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-secondary font-mono max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {row.actor_email}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${color}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-secondary max-w-[240px]">
                      {row.target_email && (
                        <span className="font-mono text-fg-secondary">{row.target_email}</span>
                      )}
                      {detail && (
                        <span className={row.target_email ? ' · ' : ''}>{detail}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-bg-raised border border-border rounded-xl px-6 py-12 text-center text-sm text-fg-secondary">
          No audit events recorded yet.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <a
            href={page > 1 ? buildUrl({ page: page - 1 }) : '#'}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${page > 1 ? 'border-border text-fg-secondary hover:text-fg-primary hover:bg-bg-hover' : 'border-transparent text-fg-tertiary pointer-events-none'}`}
          >
            ← Previous
          </a>
          <span className="text-xs text-fg-tertiary">Page {page} of {totalPages}</span>
          <a
            href={page < totalPages ? buildUrl({ page: page + 1 }) : '#'}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${page < totalPages ? 'border-border text-fg-secondary hover:text-fg-primary hover:bg-bg-hover' : 'border-transparent text-fg-tertiary pointer-events-none'}`}
          >
            Next →
          </a>
        </div>
      )}
    </div>
  )
}
