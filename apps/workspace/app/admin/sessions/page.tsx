import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { forceSignOut, forceSignOutAll } from '@/lib/admin-actions'

export const dynamic = 'force-dynamic'

type SessionRow = {
  session_id: string
  user_id: string
  user_email: string
  user_name: string | null
  role: string | null
  created_at: string
  expires_at: string
  is_self_session: boolean
}

function timeAgo(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function timeLeft(ts: string): string {
  const secs = Math.floor((new Date(ts).getTime() - Date.now()) / 1000)
  if (secs < 0) return 'Expired'
  if (secs < 3600) return `${Math.floor(secs / 60)}m left`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h left`
  return `${Math.floor(secs / 86400)}d left`
}

function initials(email: string, name: string | null) {
  if (name) return name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

const roleColors: Record<string, string> = {
  owner:  'bg-indigo-500/10 text-indigo-500',
  admin:  'bg-blue-500/10 text-blue-500',
  member: 'bg-fg-tertiary/10 text-fg-tertiary',
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>
}) {
  const session = await requireAdmin()
  const params = await searchParams

  const rows = await db`
    SELECT
      s.id          AS session_id,
      u.id          AS user_id,
      u.email       AS user_email,
      u.name        AS user_name,
      m.role,
      s.created_at,
      s.expires_at,
      (s.id = ${session.sessionId}) AS is_self_session
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN org_members m ON m.user_id = u.id AND m.org_id = ${session.orgId!}
    WHERE s.org_id = ${session.orgId!}
      AND s.expires_at > NOW()
      AND u.deactivated_at IS NULL
    ORDER BY u.email ASC, s.created_at DESC
  ` as unknown as SessionRow[]

  // Group by user
  const byUser = new Map<string, { user: SessionRow; sessions: SessionRow[] }>()
  for (const row of rows) {
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, { user: row, sessions: [] })
    }
    byUser.get(row.user_id)!.sessions.push(row)
  }
  const groups = Array.from(byUser.values())

  const totalSessions = rows.length
  const uniqueUsers = groups.length

  const canActOn = (targetRole: string | null) => {
    if (session.role === 'owner') return true
    if (session.role === 'admin') return targetRole === 'member'
    return false
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-primary">Active Sessions</h1>
        <p className="text-sm text-fg-secondary mt-1">
          All currently active sign-in sessions across your organization.
        </p>
      </div>

      {params.msg && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm">
          {decodeURIComponent(params.msg)}
        </div>
      )}
      {params.err && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 text-sm">
          {decodeURIComponent(params.err)}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-bg-raised border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-fg-primary">{totalSessions}</div>
          <div className="text-xs text-fg-secondary mt-0.5">Active session{totalSessions !== 1 ? 's' : ''}</div>
        </div>
        <div className="bg-bg-raised border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-fg-primary">{uniqueUsers}</div>
          <div className="text-xs text-fg-secondary mt-0.5">Signed-in user{uniqueUsers !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-bg-raised border border-border rounded-xl px-6 py-12 text-center text-sm text-fg-secondary">
          No active sessions.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(({ user, sessions: userSessions }) => {
            const canAct = !userSessions.every(s => s.is_self_session) && canActOn(user.role)
            return (
              <div key={user.user_id} className="bg-bg-raised border border-border rounded-xl overflow-hidden">
                {/* User header */}
                <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <span className="text-accent text-xs font-semibold">
                        {initials(user.user_email, user.user_name)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      {user.user_name && (
                        <div className="text-sm font-medium text-fg-primary leading-tight">{user.user_name}</div>
                      )}
                      <div className="text-xs text-fg-secondary overflow-hidden text-ellipsis whitespace-nowrap">
                        {user.user_email}
                      </div>
                    </div>
                    {user.role && (
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${roleColors[user.role] ?? roleColors.member}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    )}
                    <span className="text-xs text-fg-tertiary shrink-0">
                      {userSessions.length} session{userSessions.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {canAct && (
                    <form action={forceSignOutAll.bind(null, user.user_id)}>
                      <button
                        type="submit"
                        className="text-xs font-medium text-red-500 border border-red-500/30 hover:bg-red-500/5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Sign out all
                      </button>
                    </form>
                  )}
                </div>

                {/* Sessions */}
                <div className="divide-y divide-border">
                  {userSessions.map(s => (
                    <div key={s.session_id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-fg-tertiary">
                            {s.session_id.slice(0, 8)}…
                          </div>
                          <div className="text-xs text-fg-tertiary mt-0.5">
                            Started {timeAgo(s.created_at)} · {timeLeft(s.expires_at)}
                          </div>
                        </div>
                        {s.is_self_session && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium shrink-0">
                            This session
                          </span>
                        )}
                      </div>

                      {!s.is_self_session && canAct && (
                        <form action={forceSignOut.bind(null, s.session_id)}>
                          <button
                            type="submit"
                            className="text-xs font-medium text-fg-secondary hover:text-red-600 border border-border hover:border-red-500/30 hover:bg-red-500/5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Sign out
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
