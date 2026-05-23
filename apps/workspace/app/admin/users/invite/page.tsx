import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { createInvite } from '@/lib/actions'

export const dynamic = 'force-dynamic'

export default async function InviteUserPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await requireAdmin()
  const sp = await searchParams
  const createdId = sp.created ?? null
  const errMsg = sp.err ? decodeURIComponent(sp.err) : null

  let inviteLink: string | null = null
  let invitedEmail: string | null = null
  let invitedRole: string | null = null

  if (createdId && session.orgId) {
    const rows = await db`
      SELECT token, email, role FROM invites
      WHERE id = ${createdId} AND org_id = ${session.orgId}
    `
    if (rows.length) {
      const appUrl = (process.env.APP_URL ?? 'https://foundry.adams-ai.com').replace(/\/$/, '')
      inviteLink = `${appUrl}/invite/${rows[0].token}`
      invitedEmail = rows[0].email as string
      invitedRole = rows[0].role as string
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <a href="/admin/users" className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors">
          ← Back to users
        </a>
        <h1 className="text-xl font-semibold text-fg-primary mt-3">Invite user</h1>
        <p className="text-sm text-fg-secondary mt-1">
          Send an invitation link to add someone to your organization.
        </p>
      </div>

      {errMsg && (
        <div className="mb-6 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>
        </div>
      )}

      {inviteLink && (
        <div className="mb-6 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-500">
              <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Invite created for {invitedEmail} ({invitedRole})
            </span>
          </div>
          <p className="text-xs text-fg-secondary mb-2">
            {process.env.SMTP_HOST
              ? 'An email has been sent. Copy the link below as a backup.'
              : 'SMTP is not configured — share this link manually:'}
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 text-xs bg-bg-base border border-border rounded-lg px-3 py-2 text-fg-primary font-mono select-all"
            />
          </div>
          <p className="text-xs text-fg-tertiary mt-2">Expires in 7 days.</p>
        </div>
      )}

      <form action={createInvite} className="bg-bg-raised border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-fg-primary mb-1.5">
            Email address
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="user@example.com"
            className="w-full px-3 py-2 bg-bg-base border border-border rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-primary mb-1.5">
            Role
          </label>
          <select
            name="role"
            defaultValue="member"
            className="w-full px-3 py-2 bg-bg-base border border-border rounded-lg text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60"
          >
            <option value="member">Member — standard access</option>
            <option value="admin">Admin — can manage users and settings</option>
            <option value="owner">Owner — full control</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-accent hover:bg-accent-hover text-accent-fg font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          Send invitation
        </button>
      </form>
    </div>
  )
}
