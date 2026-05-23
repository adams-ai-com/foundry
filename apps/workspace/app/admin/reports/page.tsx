import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { getOrgTimezone } from '@/lib/timezone'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

const SUSPICIOUS_THRESHOLD = 5  // failures in 24h = flagged

type FailureSummary = {
  actor_email: string
  reason_counts: Record<string, number>
  total: number
  last_attempt: string
  in_org: boolean
  failures_24h: number
}

const REASON_LABELS: Record<string, string> = {
  bad_totp:    'Wrong TOTP code',
  not_allowed: 'Email not allowed',
  deactivated: 'Account deactivated',
}

export default async function ReportsPage() {
  const session = await requireAdmin()
  const tz = await getOrgTimezone(session.orgId!)

  // Org member emails for cross-referencing unknown-org failures
  const memberEmails = await db`
    SELECT u.email FROM users u
    JOIN org_members m ON m.user_id = u.id
    WHERE m.org_id = ${session.orgId!}
  ` as unknown as Array<{ email: string }>
  const orgEmailSet = new Set(memberEmails.map(r => r.email))

  // All failed sign-in events relevant to this org:
  // — those logged with org_id = this org, OR
  // — those with org_id = null but email is an org member
  const failures = await db`
    SELECT actor_email, metadata, created_at
    FROM audit_log
    WHERE action = 'auth.sign_in_failed'
      AND (
        org_id = ${session.orgId!}
        OR (org_id IS NULL AND actor_email = ANY(${memberEmails.map(r => r.email)}::text[]))
      )
    ORDER BY created_at DESC
    LIMIT 500
  ` as unknown as Array<{ actor_email: string; metadata: { reason?: string }; created_at: string }>

  // Summary stats
  const now = Date.now()
  const ms24h = 24 * 60 * 60 * 1000
  const ms7d  =  7 * 24 * 60 * 60 * 1000
  const ms30d = 30 * 24 * 60 * 60 * 1000

  const count24h  = failures.filter(f => now - new Date(f.created_at).getTime() < ms24h).length
  const count7d   = failures.filter(f => now - new Date(f.created_at).getTime() < ms7d).length
  const count30d  = failures.filter(f => now - new Date(f.created_at).getTime() < ms30d).length
  const uniqueEmails = new Set(failures.map(f => f.actor_email)).size

  // Group by email
  const byEmail = new Map<string, FailureSummary>()
  for (const f of failures) {
    if (!byEmail.has(f.actor_email)) {
      byEmail.set(f.actor_email, {
        actor_email: f.actor_email,
        reason_counts: {},
        total: 0,
        last_attempt: f.created_at,
        in_org: orgEmailSet.has(f.actor_email),
        failures_24h: 0,
      })
    }
    const entry = byEmail.get(f.actor_email)!
    entry.total++
    const reason = f.metadata?.reason ?? 'unknown'
    entry.reason_counts[reason] = (entry.reason_counts[reason] ?? 0) + 1
    if (now - new Date(f.created_at).getTime() < ms24h) entry.failures_24h++
  }

  const summaries = Array.from(byEmail.values())
    .sort((a, b) => b.total - a.total)

  const suspicious = summaries.filter(s => s.failures_24h >= SUSPICIOUS_THRESHOLD)

  function timeAgo(ts: string): string {
    const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (secs < 60)   return `${secs}s ago`
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
    return `${Math.floor(secs / 86400)}d ago`
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-primary">Security Reports</h1>
        <p className="text-sm text-fg-secondary mt-1">Failed sign-in attempts and suspicious activity.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Last 24h',       value: count24h },
          { label: 'Last 7 days',    value: count7d   },
          { label: 'Last 30 days',   value: count30d  },
          { label: 'Unique emails',  value: uniqueEmails },
        ].map(stat => (
          <div key={stat.label} className="bg-bg-raised border border-border rounded-xl p-4">
            <div className={`text-2xl font-bold ${stat.value > 0 && stat.label !== 'Unique emails' ? 'text-amber-500' : 'text-fg-primary'}`}>
              {stat.value}
            </div>
            <div className="text-xs text-fg-secondary mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Suspicious flag */}
      {suspicious.length > 0 && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="text-sm font-semibold text-red-600 mb-1">
            {suspicious.length} account{suspicious.length !== 1 ? 's' : ''} flagged — {SUSPICIOUS_THRESHOLD}+ failures in 24 hours
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {suspicious.map(s => (
              <span key={s.actor_email} className="text-xs font-mono bg-red-500/10 text-red-600 px-2 py-0.5 rounded border border-red-500/20">
                {s.actor_email} ({s.failures_24h}×)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Failure table */}
      {summaries.length === 0 ? (
        <div className="bg-bg-raised border border-border rounded-xl px-6 py-12 text-center">
          <p className="text-sm text-fg-secondary">No failed sign-in attempts recorded.</p>
          <p className="text-xs text-fg-tertiary mt-1">Failed attempts will appear here as they occur.</p>
        </div>
      ) : (
        <>
          <div className="bg-bg-raised border border-border rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-fg-primary">Failed attempts by account</h2>
              <span className="text-xs text-fg-tertiary">{summaries.length} email{summaries.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Reason</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide">24h</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Total</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summaries.map(s => {
                  const isSuspicious = s.failures_24h >= SUSPICIOUS_THRESHOLD
                  const topReason = Object.entries(s.reason_counts).sort((a, b) => b[1] - a[1])[0]
                  return (
                    <tr key={s.actor_email} className={`hover:bg-bg-hover transition-colors ${isSuspicious ? 'bg-red-500/5' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {isSuspicious && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" title="Suspicious activity" />
                          )}
                          <span className="text-xs font-mono text-fg-primary">{s.actor_email}</span>
                          {s.in_org && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">member</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-fg-secondary">
                          {topReason ? REASON_LABELS[topReason[0]] ?? topReason[0] : '—'}
                          {Object.keys(s.reason_counts).length > 1 && (
                            <span className="text-fg-tertiary"> +{Object.keys(s.reason_counts).length - 1} more</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-medium ${s.failures_24h >= SUSPICIOUS_THRESHOLD ? 'text-red-500' : s.failures_24h > 0 ? 'text-amber-500' : 'text-fg-tertiary'}`}>
                          {s.failures_24h}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-fg-secondary">{s.total}</td>
                      <td className="px-4 py-3 text-right text-xs text-fg-tertiary whitespace-nowrap">
                        {timeAgo(s.last_attempt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-fg-tertiary">
            Showing up to 500 most recent failures. View full detail in the{' '}
            <Link href="/admin/audit?cat=auth" className="text-accent hover:underline">
              Audit Log
            </Link>.
          </p>
        </>
      )}
    </div>
  )
}
