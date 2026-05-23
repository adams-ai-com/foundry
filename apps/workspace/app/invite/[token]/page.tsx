import { notFound } from 'next/navigation'
import db from '@/lib/db'
import { beginInviteLogin } from '@/lib/actions'

export const dynamic = 'force-dynamic'

type InviteRow = {
  email: string
  role: string
  org_name: string
  inviter_email: string
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const rows = await db`
    SELECT i.email, i.role, o.name as org_name, u.email as inviter_email
    FROM invites i
    JOIN orgs o ON o.id = i.org_id
    JOIN users u ON u.id = i.invited_by
    WHERE i.token = ${token}
      AND i.accepted_at IS NULL
      AND i.expires_at > NOW()
  `
  if (!rows.length) notFound()

  const invite = rows[0] as InviteRow
  const roleLabel = invite.role.charAt(0).toUpperCase() + invite.role.slice(1)

  const roleColors: Record<string, string> = {
    owner: 'bg-indigo-500/10 text-indigo-500',
    admin: 'bg-blue-500/10 text-blue-500',
    member: 'bg-fg-tertiary/10 text-fg-tertiary',
  }

  const acceptWithToken = beginInviteLogin.bind(null, token)

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-bg-raised border border-border rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-accent-fg">
                <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h10a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h6a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1z"/>
              </svg>
            </div>
            <span className="font-semibold text-fg-primary text-sm">Foundry</span>
          </div>

          <h1 className="text-xl font-semibold text-fg-primary mb-1">You have been invited</h1>
          <p className="text-sm text-fg-secondary mb-6">
            {invite.inviter_email} invited you to join{' '}
            <span className="font-medium text-fg-primary">{invite.org_name}</span>
          </p>

          <div className="bg-bg-base border border-border rounded-xl p-4 mb-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-tertiary">Email</span>
              <span className="text-fg-primary font-medium">{invite.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-tertiary">Role</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${roleColors[invite.role] ?? roleColors.member}`}>
                {roleLabel}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-tertiary">Organization</span>
              <span className="text-fg-primary font-medium">{invite.org_name}</span>
            </div>
          </div>

          <form action={acceptWithToken}>
            <button
              type="submit"
              className="w-full bg-accent hover:bg-accent-hover text-accent-fg font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              Accept invitation →
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
