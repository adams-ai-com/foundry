import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { bulkDeactivate, bulkRemove } from '@/lib/admin-actions'
import UsersTable from './UsersTable'

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
    JOIN org_members m ON m.user_id = u.id AND m.org_id = ${orgId}
    LEFT JOIN sessions s ON s.user_id = u.id AND s.org_id = ${orgId}
    WHERE (${q} = '' OR u.email ILIKE ${search} OR COALESCE(u.name, '') ILIKE ${search})
    GROUP BY u.id, u.email, u.name, m.role, m.joined_at
    ORDER BY m.joined_at DESC NULLS LAST, u.created_at DESC
    LIMIT ${PER_PAGE} OFFSET ${offset}
  `

  const countRows = await db`
    SELECT COUNT(DISTINCT u.id)::int AS n
    FROM users u
    JOIN org_members m ON m.user_id = u.id AND m.org_id = ${orgId}
    WHERE (${q} = '' OR u.email ILIKE ${search} OR COALESCE(u.name, '') ILIKE ${search})
  `

  return { users: rows as unknown as UserRow[], total: countRows[0].n as number }
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
  const msg = sp.msg ? decodeURIComponent(sp.msg) : null
  const err = sp.err ? decodeURIComponent(sp.err) : null

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
        <div className="flex items-center gap-2">
          <a
            href="/admin/users/export"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary border border-border hover:bg-bg-hover px-3 py-2 rounded-lg transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export CSV
          </a>
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
      </div>

      {msg && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 text-sm">
          {err}
        </div>
      )}

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

      <UsersTable users={users} bulkDeactivate={bulkDeactivate} bulkRemove={bulkRemove} />

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
