import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { addDomain, verifyDomain, removeDomain, setPrimaryDomain, checkDomainHealth, checkAllDomainHealth } from '@/lib/admin-actions'
import ConfirmForm from '@/components/ConfirmForm'

export const dynamic = 'force-dynamic'

type DomainRow = {
  id: string
  domain: string
  verification_token: string
  verified_at: string | null
  is_primary: boolean
  created_at: string
  health_status: 'healthy' | 'degraded' | 'error' | null
  health_issues: string[]
  health_checked_at: string | null
}

function HealthBadge({ status }: { status: DomainRow['health_status'] }) {
  if (!status) return null
  const map = {
    healthy:  { dot: 'bg-emerald-400', label: 'Healthy',  text: 'text-emerald-600',  bg: 'bg-emerald-500/10' },
    degraded: { dot: 'bg-amber-400',   label: 'Degraded', text: 'text-amber-600',    bg: 'bg-amber-500/10'   },
    error:    { dot: 'bg-red-400',     label: 'Error',    text: 'text-red-600',      bg: 'bg-red-500/10'     },
  }
  const s = map[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>
}) {
  const session = await requireAdmin()
  const params = await searchParams

  const domains = await db`
    SELECT id, domain, verification_token, verified_at, is_primary, created_at,
           health_status, health_issues, health_checked_at
    FROM domains WHERE org_id = ${session.orgId!}
    ORDER BY created_at ASC
  ` as unknown as DomainRow[]

  const hasVerified = domains.some(d => d.verified_at)

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Domains</h1>
          <p className="text-sm text-fg-secondary mt-1">
            Add and verify custom domains for your organization.
          </p>
        </div>
        {hasVerified && (
          <form action={checkAllDomainHealth}>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium bg-bg-raised hover:bg-bg-hover border border-border text-fg-secondary hover:text-fg-primary rounded-lg transition-colors"
            >
              Check all
            </button>
          </form>
        )}
      </div>

      {params.msg && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm">
          {decodeURIComponent(params.msg)}
        </div>
      )}
      {params.err && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 text-sm">
          {decodeURIComponent(params.err)}
        </div>
      )}

      {/* Domain list */}
      {domains.length > 0 && (
        <div className="bg-bg-raised border border-border rounded-xl divide-y divide-border mb-6">
          {domains.map(d => (
            <div key={d.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-fg-primary text-sm">{d.domain}</span>
                    {d.is_primary && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Primary</span>
                    )}
                    {d.verified_at ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">Verified</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">Pending verification</span>
                    )}
                    <HealthBadge status={d.health_status} />
                  </div>
                  <p className="text-xs text-fg-tertiary">
                    Added {new Date(d.created_at).toLocaleDateString()}
                    {d.verified_at && ` · Verified ${new Date(d.verified_at).toLocaleDateString()}`}
                    {d.health_checked_at && ` · Checked ${new Date(d.health_checked_at).toLocaleString()}`}
                  </p>

                  {/* Health issues */}
                  {d.health_issues?.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {d.health_issues.map((issue, i) => (
                        <li key={i} className="text-xs text-red-600 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Verification instructions for unverified domains */}
                  {!d.verified_at && (
                    <div className="mt-3 p-3 bg-bg-base border border-border rounded-lg">
                      <p className="text-xs font-medium text-fg-secondary mb-2">
                        Add this TXT record to your DNS:
                      </p>
                      <div className="space-y-1.5 font-mono text-xs">
                        <div className="flex gap-2">
                          <span className="text-fg-tertiary w-16 shrink-0">Host</span>
                          <span className="text-fg-primary select-all">_foundry-verify.{d.domain}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-fg-tertiary w-16 shrink-0">Type</span>
                          <span className="text-fg-primary">TXT</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-fg-tertiary w-16 shrink-0">Value</span>
                          <span className="text-fg-primary select-all break-all">
                            foundry-verify={d.verification_token}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-fg-tertiary mt-2">
                        DNS changes can take up to 48 hours to propagate.
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {!d.verified_at && (
                    <form action={verifyDomain.bind(null, d.id)}>
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors"
                      >
                        Verify
                      </button>
                    </form>
                  )}
                  {d.verified_at && (
                    <form action={checkDomainHealth.bind(null, d.id)}>
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-medium bg-bg-base hover:bg-bg-hover text-fg-secondary hover:text-fg-primary border border-border rounded-lg transition-colors"
                      >
                        Check
                      </button>
                    </form>
                  )}
                  {d.verified_at && !d.is_primary && (
                    <form action={setPrimaryDomain.bind(null, d.id)}>
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-medium bg-bg-base hover:bg-bg-hover text-fg-secondary hover:text-fg-primary border border-border rounded-lg transition-colors"
                      >
                        Set primary
                      </button>
                    </form>
                  )}
                  {d.verified_at && (
                    <Link
                      href={`/admin/domains/${d.id}`}
                      className="px-3 py-1.5 text-xs font-medium bg-bg-base hover:bg-bg-hover text-fg-secondary hover:text-fg-primary border border-border rounded-lg transition-colors"
                    >
                      Email setup →
                    </Link>
                  )}
                  <ConfirmForm
                    action={removeDomain.bind(null, d.id)}
                    message={`Remove ${d.domain}? This cannot be undone.`}
                  >
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-medium bg-bg-base hover:bg-red-500/10 text-fg-secondary hover:text-red-600 border border-border rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </ConfirmForm>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add domain form */}
      <div className="bg-bg-raised border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-fg-primary mb-4">Add a domain</h2>
        <form action={addDomain} className="flex gap-3">
          <input
            type="text"
            name="domain"
            placeholder="example.com"
            required
            className="flex-1 px-3 py-2 text-sm bg-bg-base border border-border rounded-lg text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors whitespace-nowrap"
          >
            Add domain
          </button>
        </form>
        <p className="text-xs text-fg-tertiary mt-2">
          Enter the bare domain (e.g. <code className="font-mono">example.com</code>) — no https:// needed.
        </p>
      </div>
    </div>
  )
}
