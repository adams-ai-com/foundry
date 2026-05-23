import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { revokeInvite, resendInvite } from '@/lib/admin-actions'
import ConfirmForm from '@/components/ConfirmForm'

export const dynamic = 'force-dynamic'

type InviteRow = {
  id: string
  email: string
  role: string
  invited_by_email: string | null
  expires_at: string
  accepted_at: string | null
  created_at: string
}

function roleBadge(role: string) {
  const styles: Record<string, string> = {
    owner:  'bg-indigo-500/10 text-indigo-500',
    admin:  'bg-blue-500/10 text-blue-500',
    member: 'bg-fg-tertiary/10 text-fg-tertiary',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${styles[role] ?? styles.member}`}>
      {role}
    </span>
  )
}

function statusBadge(invite: InviteRow) {
  if (invite.accepted_at) {
    return <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Accepted</span>
  }
  if (new Date(invite.expires_at) < new Date()) {
    return <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-fg-tertiary"><span className="w-1.5 h-1.5 rounded-full bg-fg-tertiary/40 inline-block" />Expired</span>
  }
  return <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Pending</span>
}

function fmtDate(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeLeft(expires_at: string): string {
  const ms = new Date(expires_at).getTime() - Date.now()
  if (ms <= 0) return ''
  const h = Math.floor(ms / 3600000)
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; filter?: string }>
}) {
  const session = await requireAdmin()
  const sp = await searchParams
  const filter = sp.filter ?? 'pending'

  const rows = await db`
    SELECT
      i.id, i.email, i.role, i.expires_at, i.accepted_at, i.created_at,
      u.email AS invited_by_email
    FROM invites i
    LEFT JOIN users u ON u.id = i.invited_by
    WHERE i.org_id = ${session.orgId!}
    ORDER BY i.created_at DESC
    LIMIT 200
  ` as unknown as InviteRow[]

  const now = new Date()
  const pending  = rows.filter(r => !r.accepted_at && new Date(r.expires_at) > now)
  const accepted = rows.filter(r => !!r.accepted_at)
  const expired  = rows.filter(r => !r.accepted_at && new Date(r.expires_at) <= now)

  const visible = filter === 'accepted' ? accepted : filter === 'expired' ? expired : pending

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Invites</h1>
          <p className="text-sm text-fg-secondary mt-1">
            {pending.length} pending · {accepted.length} accepted · {expired.length} expired
          </p>
        </div>
        <Link
          href="/admin/users/invite"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-fg text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          Send invite
        </Link>
      </div>

      {sp.msg && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm">
          {decodeURIComponent(sp.msg)}
        </div>
      )}
      {sp.err && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 text-sm">
          {decodeURIComponent(sp.err)}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-bg-raised border border-border rounded-lg p-1 w-fit">
        {[
          { key: 'pending',  label: `Pending (${pending.length})` },
          { key: 'accepted', label: `Accepted (${accepted.length})` },
          { key: 'expired',  label: `Expired (${expired.length})` },
        ].map(tab => (
          <a
            key={tab.key}
            href={`/admin/invites?filter=${tab.key}`}
            className={[
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              filter === tab.key
                ? 'bg-bg-base text-fg-primary shadow-sm border border-border'
                : 'text-fg-secondary hover:text-fg-primary',
            ].join(' ')}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <div className="bg-bg-raised border border-border rounded-xl overflow-hidden">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-fg-secondary">
            No {filter} invites.
            {filter === 'pending' && (
              <span> <Link href="/admin/users/invite" className="text-accent hover:underline">Send one →</Link></span>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Invited by</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-tertiary">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map(invite => {
                const isPending = !invite.accepted_at && new Date(invite.expires_at) > now
                const isExpired = !invite.accepted_at && new Date(invite.expires_at) <= now
                const revokeWithId = revokeInvite.bind(null, invite.id)
                const resendWithId = resendInvite.bind(null, invite.id)
                return (
                  <tr key={invite.id} className="hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-3 font-medium text-fg-primary text-xs">{invite.email}</td>
                    <td className="px-4 py-3">{roleBadge(invite.role)}</td>
                    <td className="px-4 py-3">{statusBadge(invite)}</td>
                    <td className="px-4 py-3 text-xs text-fg-secondary">{invite.invited_by_email ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-fg-secondary">{fmtDate(invite.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-fg-secondary">
                      {fmtDate(invite.expires_at)}
                      {isPending && <span className="ml-1 text-fg-tertiary">· {timeLeft(invite.expires_at)}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isPending && (
                        <ConfirmForm action={revokeWithId} message={`Revoke invite for ${invite.email}?`}>
                          <button
                            type="submit"
                            className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                          >
                            Revoke
                          </button>
                        </ConfirmForm>
                      )}
                      {isExpired && (
                        <form action={resendWithId}>
                          <button
                            type="submit"
                            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            Resend
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
