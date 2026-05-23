import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import Link from 'next/link'
import { createGroup } from '@/lib/admin-actions'

export const dynamic = 'force-dynamic'

type GroupRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  member_count: number
}

async function getGroups(orgId: string): Promise<GroupRow[]> {
  const rows = await db`
    SELECT
      g.id, g.name, g.description, g.created_at,
      COUNT(gm.user_id)::int AS member_count
    FROM org_groups g
    LEFT JOIN org_group_members gm ON gm.group_id = g.id
    WHERE g.org_id = ${orgId}
    GROUP BY g.id, g.name, g.description, g.created_at
    ORDER BY g.name ASC
  `
  return rows as unknown as GroupRow[]
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await requireAdmin()
  if (!session.orgId) return <div className="p-8 text-fg-secondary">No active organization.</div>

  const sp = await searchParams
  const msg = sp.msg ? decodeURIComponent(sp.msg) : null
  const err = sp.err ? decodeURIComponent(sp.err) : null

  const groups = await getGroups(session.orgId)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Groups</h1>
          <p className="text-sm text-fg-secondary mt-1">
            {groups.length} {groups.length === 1 ? 'group' : 'groups'}
          </p>
        </div>
      </div>

      {msg && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 text-sm">
          {err}
        </div>
      )}

      {/* Create group */}
      <div className="bg-bg-raised border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-fg-primary mb-4">Create group</h2>
        <form action={createGroup} className="flex flex-col sm:flex-row gap-3">
          <input
            name="name"
            required
            maxLength={100}
            placeholder="Group name"
            className="flex-1 px-3 py-2 bg-bg-base border border-border rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60"
          />
          <input
            name="description"
            maxLength={200}
            placeholder="Description (optional)"
            className="flex-1 px-3 py-2 bg-bg-base border border-border rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-fg text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Create group
          </button>
        </form>
      </div>

      {/* Groups table */}
      <div className="bg-bg-raised border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Description</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Members</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-fg-tertiary text-sm">
                  No groups yet — create one above
                </td>
              </tr>
            )}
            {groups.map(group => (
              <tr key={group.id} className="hover:bg-bg-hover transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-accent">
                        <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0z"/>
                      </svg>
                    </div>
                    <span className="font-medium text-fg-primary">{group.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-fg-secondary max-w-xs truncate">
                  {group.description ?? <span className="text-fg-tertiary italic">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-sm text-fg-secondary">
                    {group.member_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-fg-secondary">{fmtDate(group.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/groups/${group.id}`}
                    className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
