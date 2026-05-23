import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getStats() {
  const [users, activeSessions, orgs, members] = await Promise.all([
    db`SELECT COUNT(*)::int as n FROM users`,
    db`SELECT COUNT(*)::int as n FROM sessions WHERE expires_at > NOW()`,
    db`SELECT COUNT(*)::int as n FROM orgs`,
    db`SELECT COUNT(*)::int as n FROM org_members`,
  ])
  return {
    users: users[0].n as number,
    activeSessions: activeSessions[0].n as number,
    orgs: orgs[0].n as number,
    members: members[0].n as number,
  }
}

export default async function AdminOverviewPage() {
  await requireAdmin()
  const stats = await getStats()

  const cards = [
    { label: 'Total Users',      value: stats.users,          sub: 'registered accounts' },
    { label: 'Active Sessions',  value: stats.activeSessions, sub: 'sessions not yet expired' },
    { label: 'Organizations',    value: stats.orgs,           sub: 'workspaces' },
    { label: 'Org Members',      value: stats.members,        sub: 'user-org relationships' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-fg-primary">Overview</h1>
        <p className="text-sm text-fg-secondary mt-1">Foundry workspace at a glance</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {cards.map(card => (
          <div key={card.label} className="bg-bg-raised border border-border rounded-xl p-5">
            <div className="text-2xl font-semibold text-fg-primary tabular-nums">{card.value}</div>
            <div className="text-sm font-medium text-fg-primary mt-1">{card.label}</div>
            <div className="text-xs text-fg-tertiary mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-bg-raised border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-fg-primary mb-4">Quick links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Manage Users',   href: '/admin/users' },
            { label: 'Manage Groups',  href: '/admin/groups' },
            { label: 'Domain Setup',   href: '/admin/domains' },
            { label: 'App Access',     href: '/admin/apps' },
            { label: 'Audit Log',      href: '/admin/audit' },
            { label: 'Security Policy', href: '/admin/security' },
          ].map(link => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-center justify-between px-4 py-3 bg-bg-base border border-border rounded-lg text-sm text-fg-secondary hover:text-fg-primary hover:border-accent/40 transition-colors"
            >
              {link.label}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 flex-shrink-0 ml-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
