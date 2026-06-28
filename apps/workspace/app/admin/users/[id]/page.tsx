import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getOrgTimezone } from '@/lib/timezone'
import db from '@/lib/db'
import { deactivateUser, reactivateUser, removeFromOrg, resetTotp, changeRole, updateAppAccess, setUserPassword } from '@/lib/admin-actions'
import ConfirmForm from '@/components/ConfirmForm'

export const dynamic = 'force-dynamic'

type UserDetail = {
  id: string
  email: string
  name: string | null
  deactivated_at: string | null
  created_at: string
  role: string | null
  joined_at: string | null
  active_sessions: number
  last_sign_in: string | null
  has_totp: boolean
  has_password: boolean
  has_ms_sso: boolean
}

async function getUserDetail(orgId: string, userId: string): Promise<UserDetail | null> {
  const rows = await db`
    SELECT
      u.id, u.email, u.name, u.deactivated_at, u.created_at,
      m.role, m.joined_at,
      COUNT(CASE WHEN s.expires_at > NOW() THEN 1 END)::int AS active_sessions,
      MAX(s.created_at) AS last_sign_in,
      (u.totp_secret IS NOT NULL) AS has_totp,
      (u.password_hash IS NOT NULL) AS has_password,
      (u.ms_oid IS NOT NULL) AS has_ms_sso
    FROM users u
    LEFT JOIN org_members m ON m.user_id = u.id AND m.org_id = ${orgId}
    LEFT JOIN sessions s ON s.user_id = u.id
    WHERE u.id = ${userId}
    GROUP BY u.id, u.email, u.name, u.deactivated_at, u.created_at, m.role, m.joined_at, u.totp_secret
  `
  return rows.length ? rows[0] as unknown as UserDetail : null
}

function fmtDate(ts: string | null, tz = 'UTC') {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz })
}

function initials(email: string, name: string | null) {
  if (name) return name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

const roleColors: Record<string, string> = {
  owner: 'bg-indigo-500/10 text-indigo-500',
  admin: 'bg-blue-500/10 text-blue-500',
  member: 'bg-fg-tertiary/10 text-fg-tertiary',
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string>>
}) {
  const session = await requireAdmin()
  const { id } = await params
  const sp = await searchParams
  const msg = sp.msg ? decodeURIComponent(sp.msg) : null
  const err = sp.err ? decodeURIComponent(sp.err) : null

  if (!session.orgId) return <div className="p-8 text-fg-secondary">No active organization.</div>
  const tz = await getOrgTimezone(session.orgId)

  const user = await getUserDetail(session.orgId, id)
  if (!user) notFound()

  const isSelf = id === session.userId
  const isDeactivated = !!user.deactivated_at
  const roleLabel = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : null

  const deactivateWithId = deactivateUser.bind(null, id)
  const reactivateWithId = reactivateUser.bind(null, id)
  const removeWithId = removeFromOrg.bind(null, id)
  const resetTotpWithId = resetTotp.bind(null, id)
  const changeRoleWithId = changeRole.bind(null, id)
  const updateAppAccessWithId = updateAppAccess.bind(null, id)
  const setPasswordWithId = setUserPassword.bind(null, id)

  // App access — no row = default (enabled); explicit row can disable
  const appAccessRows = await db`
    SELECT app, enabled FROM user_app_access
    WHERE org_id = ${session.orgId} AND user_id = ${id}
  ` as unknown as Array<{ app: string; enabled: boolean }>
  const appAccess = Object.fromEntries(
    ['docs', 'sheets', 'mail', 'wiki'].map(app => {
      const row = appAccessRows.find(r => r.app === app)
      return [app, row ? row.enabled : true]
    })
  ) as Record<string, boolean>

  const canAct = !isSelf && (
    session.role === 'owner' ||
    (session.role === 'admin' && user.role === 'member')
  )

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <a href="/admin/users" className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors">
          ← Back to users
        </a>
      </div>

      {msg && (
        <div className="mb-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-4 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {err}
        </div>
      )}

      {/* Profile header */}
      <div className="bg-bg-raised border border-border rounded-xl p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <span className="text-accent text-base font-semibold">{initials(user.email, user.name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            {user.name && <div className="font-semibold text-fg-primary">{user.name}</div>}
            <div className="text-sm text-fg-secondary">{user.email}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {user.role && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${roleColors[user.role] ?? roleColors.member}`}>
                  {roleLabel}
                </span>
              )}
              {isDeactivated ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-500">
                  Deactivated
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Active
                </span>
              )}
              {isSelf && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-fg-tertiary/10 text-fg-tertiary">
                  You
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
          <div>
            <div className="text-xs text-fg-tertiary mb-0.5">Active sessions</div>
            <div className="text-sm font-medium text-fg-primary">{user.active_sessions}</div>
          </div>
          <div>
            <div className="text-xs text-fg-tertiary mb-0.5">Last sign-in</div>
            <div className="text-sm font-medium text-fg-primary">{fmtDate(user.last_sign_in, tz)}</div>
          </div>
          <div>
            <div className="text-xs text-fg-tertiary mb-0.5">Member since</div>
            <div className="text-sm font-medium text-fg-primary">{fmtDate(user.joined_at, tz)}</div>
          </div>
          <div>
            <div className="text-xs text-fg-tertiary mb-0.5">TOTP</div>
            <div className="text-sm font-medium">
              {user.has_totp
                ? <span className="text-emerald-500">Enrolled</span>
                : <span className="text-amber-500">Not enrolled</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming actions — placeholders */}
      <div className="bg-bg-raised border border-border rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-fg-primary mb-3">Account management</h2>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4 py-2 border-b border-border">
            <div className="pt-0.5">
              <div className="text-sm font-medium text-fg-primary">Change role</div>
              <div className="text-xs text-fg-tertiary mt-0.5">
                Role changes take effect immediately on next request
              </div>
            </div>
            {session.role === 'owner' && !isSelf && user.role ? (
              <form action={changeRoleWithId} className="flex items-center gap-2 flex-shrink-0">
                <select
                  name="role"
                  defaultValue={user.role}
                  className="text-xs bg-bg-base border border-border rounded-lg px-2 py-1.5 text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
                <button
                  type="submit"
                  className="text-xs font-medium text-fg-primary border border-border hover:bg-bg-hover px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  Save
                </button>
              </form>
            ) : (
              <span className="text-xs text-fg-tertiary flex-shrink-0">
                {!user.role
                  ? 'Not an org member'
                  : isSelf
                  ? 'Cannot change own role'
                  : 'Only owners can change roles'}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <div className="text-sm font-medium text-fg-primary">Reset TOTP</div>
              <div className="text-xs text-fg-tertiary">
                {user.has_totp
                  ? 'Force re-enrollment — signs user out of all sessions'
                  : 'No authenticator enrolled yet'}
              </div>
            </div>
            {canAct && user.has_totp ? (
              <ConfirmForm
                action={resetTotpWithId}
                message={`Reset TOTP for ${user.email}? They will be signed out of all sessions and must re-enroll their authenticator.`}
              >
                <button
                  type="submit"
                  className="text-xs font-medium text-amber-600 border border-amber-500/30 hover:bg-amber-500/5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  Reset TOTP
                </button>
              </ConfirmForm>
            ) : (
              <span className="text-xs text-fg-tertiary">
                {!user.has_totp ? 'Not enrolled' : isSelf ? 'Cannot modify own account' : 'Insufficient permissions'}
              </span>
            )}
          </div>

          {/* Set password (non-MS users) */}
          {!user.has_ms_sso && canAct && (
            <div className="pt-2">
              <div className="mb-2">
                <div className="text-sm font-medium text-fg-primary">
                  {user.has_password ? 'Reset password' : 'Set password'}
                </div>
                <div className="text-xs text-fg-tertiary mt-0.5">
                  {user.has_password
                    ? 'Replace the current password for this account'
                    : 'Set a password so this user can sign in'}
                </div>
              </div>
              <form action={setPasswordWithId} className="flex items-center gap-2 flex-wrap">
                <input
                  type="password"
                  name="password"
                  required
                  minLength={10}
                  placeholder="New password (min 10 chars)"
                  className="text-xs bg-bg-base border border-border rounded-lg px-3 py-1.5 text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 w-56"
                />
                <button
                  type="submit"
                  className="text-xs font-medium text-fg-primary border border-border hover:bg-bg-hover px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  {user.has_password ? 'Reset' : 'Set password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-bg-raised border border-red-500/20 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-red-500 mb-3">Danger zone</h2>
        <div className="space-y-3">

          {/* Deactivate / Reactivate */}
          <div className="flex items-center justify-between gap-4">
            <div>
              {isDeactivated ? (
                <>
                  <div className="text-sm font-medium text-fg-primary">Reactivate account</div>
                  <div className="text-xs text-fg-tertiary">Allow this user to sign in again</div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-fg-primary">Deactivate account</div>
                  <div className="text-xs text-fg-tertiary">Block sign-in and revoke all active sessions immediately</div>
                </>
              )}
            </div>
            {canAct ? (
              isDeactivated ? (
                <form action={reactivateWithId}>
                  <button
                    type="submit"
                    className="text-xs font-medium text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Reactivate
                  </button>
                </form>
              ) : (
                <ConfirmForm
                action={deactivateWithId}
                message={`Deactivate ${user.email}? They will be signed out of all sessions immediately.`}
              >
                  <button
                    type="submit"
                    className="text-xs font-medium text-red-500 border border-red-500/30 hover:bg-red-500/5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Deactivate
                  </button>
                </ConfirmForm>
              )
            ) : (
              <span className="text-xs text-fg-tertiary">{isSelf ? 'Cannot modify own account' : 'Insufficient permissions'}</span>
            )}
          </div>

          {/* App access */}
          <div className="border-t border-border pt-3">
            <div className="mb-3">
              <div className="text-sm font-medium text-fg-primary">App access</div>
              <div className="text-xs text-fg-tertiary mt-0.5">Control which OWL apps this user can open</div>
            </div>
            <form action={updateAppAccessWithId} className="space-y-2">
              {(['docs', 'sheets', 'mail', 'wiki'] as const).map(app => (
                <label key={app} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    name={`app_${app}`}
                    defaultChecked={appAccess[app]}
                    disabled={!canAct}
                    className="h-4 w-4 rounded border-border accent-accent cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className={`text-sm capitalize ${canAct ? 'text-fg-primary' : 'text-fg-secondary'}`}>
                    {app.charAt(0).toUpperCase() + app.slice(1)}
                  </span>
                </label>
              ))}
              {canAct && (
                <div className="pt-1">
                  <button
                    type="submit"
                    className="text-xs font-medium bg-accent hover:bg-accent-hover text-accent-fg px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Save app access
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="border-t border-border pt-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-fg-primary">Remove from organization</div>
              <div className="text-xs text-fg-tertiary">Revoke org access. The user account itself is not deleted.</div>
            </div>
            {canAct ? (
              <ConfirmForm
                action={removeWithId}
                message={`Remove ${user.email} from the organization? Their access will be revoked immediately.`}
              >
                <button
                  type="submit"
                  className="text-xs font-medium text-red-500 border border-red-500/30 hover:bg-red-500/5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  Remove
                </button>
              </ConfirmForm>
            ) : (
              <span className="text-xs text-fg-tertiary">{isSelf ? 'Cannot modify own account' : 'Insufficient permissions'}</span>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
