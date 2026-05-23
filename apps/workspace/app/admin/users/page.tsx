import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PER_PAGE = 20

type UserRow = {
  id: string
  email: string
  name: string | null
  role: string | null
  joined_at: string | null
  last_sign_in: string | null
  active_sessions: number
}

async function getUsers(orgId: string, q: string, page: number) {
  const offset = (page - 1) * PER_PAGE
  const search = `%${q}%`

  const rows = await db`
    SELECT
      u.id,
      u.email,
      u.name,
      m.role,
      m.joined_at,
      MAX(s.created_at) AS last_sign_in,
      COUNT(CASE WHEN s.expires_at > NOW() THEN 1 END)::int AS active_sessions
    FROM users u
    LEFT JOIN org_members m ON m.user_id = u.id AND m.org_id = ${orgId}
    LEFT JOIN sessions s ON s.user_id = u.id
    WHERE (${q} = '' OR u.email ILIKE ${search} OR COALESCE(u.name, '') ILIKE ${search})
    GROUP BY u.id, u.email, u.name, m.role, m.joined_at
    ORDER BY m.joined_at DESC NULLS LAST, u.created_at DESC
    LIMIT ${PER_PAGE} OFFSET ${offset}
  `

  const countRows = await db`
    SELECT COUNT(DISTINCT u.id)::int AS n
    FROM users u
    LEFT JOIN org_members m ON m.user_id = u.id AND m.org_id = ${orgId}
    WHERE (${q} = '' OR u.email ILIKE ${search} OR COALESCE(u.name, '') ILIKE ${search})
  `

  return { users: rows as unknown as UserRow[], total: countRows[0].n as number }
}

function roleBadge(role: string | null) {
  const styles: Record<string, string> = {
    owner: 'bg-indigo-500/10 text-indigo-500',
    admin: 'bg-blue-500/10 text-blue-500',
    member: 'bg-fg-tertiary/10 text-fg-tertiary',
  }
  const label = role ?? 'no org'
  const cls = (role && styles[role]) ?? 'bg-fg-tertiary/10 text-fg-tertiary'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

function statusBadge(activeSessions: number) {
  return activeSessions > 0
    ? <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Active</span>
    : <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-fg-tertiary"><span className="w-1.5 h-1.5 rounded-full bg-fg-tertiary/40 inline-block" />Inactive</span>
}

function fmtDate(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(email: string, name: string | null) {
  if (name) return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))

  if (!session.orgId) return <div className="p-8 text-fg-secondary">No active organization.</div>

  const { users, total } = await getUsers(session.orgId, q, page)
  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Users</h1>
          <p className="text-sm text-fg-secondary mt-1">{total} {total === 1 ? 'user' : 'users'} total</p>
        </div>
        <Link
          href="/admin/users/invite"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-fg text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          Invite user
        </Link>
      </div>

      {/* Search */}
      <form method="GET" className="mb-4">
        <div className="relative max-w-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by email or name…"
            className="w-full pl-9 pr-4 py-2 bg-bg-raised border border-border rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60"
          />
        </div>
      </form>

      {/* Table */}
      <div className="bg-bg-raised border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Last sign-in</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Member since</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-fg-tertiary text-sm">
                  {q ? `No users matching "${q}"` : 'No users yet'}
                </td>
              </tr>
            )}
            {users.map(user => (
              <tr key={user.id} className="hover:bg-bg-hover transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-accent text-xs font-semibold">{initials(user.email, user.name)}</span>
                    </div>
                    <div>
                      {user.name && <div className="font-medium text-fg-primary">{user.name}</div>}
                      <div className={user.name ? 'text-xs text-fg-tertiary' : 'text-fg-primary'}>{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{roleBadge(user.role)}</td>
                <td className="px-4 py-3">{statusBadge(user.active_sessions)}</td>
                <td className="px-4 py-3 text-fg-secondary">{fmtDate(user.last_sign_in)}</td>
                <td className="px-4 py-3 text-fg-secondary">{fmtDate(user.joined_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-fg-tertiary">
            Page {page} of {totalPages} · {total} users
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/users?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                className="px-3 py-1.5 text-xs bg-bg-raised border border-border rounded-lg text-fg-secondary hover:text-fg-primary transition-colors"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/users?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                className="px-3 py-1.5 text-xs bg-bg-raised border border-border rounded-lg text-fg-secondary hover:text-fg-primary transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
