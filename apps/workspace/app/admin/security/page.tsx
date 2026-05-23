import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { updateSecurityPolicy } from '@/lib/admin-actions'

export const dynamic = 'force-dynamic'

const TIMEOUT_OPTIONS = [
  { value: 4,    label: '4 hours' },
  { value: 8,    label: '8 hours' },
  { value: 24,   label: '1 day' },
  { value: 168,  label: '7 days' },
  { value: 720,  label: '30 days (default)' },
  { value: 2160, label: '90 days' },
]

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>
}) {
  const session = await requireAdmin()
  const params = await searchParams

  const orgRows = await db`
    SELECT require_totp, session_timeout_hours, max_sessions
    FROM orgs WHERE id = ${session.orgId!}
  `
  const org = orgRows[0] as {
    require_totp: boolean
    session_timeout_hours: number
    max_sessions: number
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-fg-primary">Security</h1>
        <p className="text-sm text-fg-secondary mt-1">
          Manage authentication requirements and session controls for your org.
        </p>
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

      <form action={updateSecurityPolicy} className="space-y-6">
        {/* TOTP enforcement */}
        <div className="bg-bg-raised border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-fg-primary mb-4">Authentication</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="require_totp"
              defaultChecked={org.require_totp}
              className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer"
            />
            <div>
              <div className="text-sm font-medium text-fg-primary">Require TOTP for all members</div>
              <div className="text-xs text-fg-secondary mt-0.5">
                Members without an authenticator app configured will be redirected to set one up
                before accessing the workspace.
              </div>
            </div>
          </label>
        </div>

        {/* Session timeout */}
        <div className="bg-bg-raised border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-fg-primary mb-4">Sessions</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-fg-primary mb-1.5">
                Session lifetime
              </label>
              <select
                name="session_timeout_hours"
                defaultValue={org.session_timeout_hours}
                className="w-full max-w-xs px-3 py-2 text-sm bg-bg-base border border-border rounded-lg text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                {TIMEOUT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-fg-secondary mt-1.5">
                How long a session stays valid after sign-in. Applies to new sessions only.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-fg-primary mb-1.5">
                Max concurrent sessions per user
              </label>
              <input
                type="number"
                name="max_sessions"
                defaultValue={org.max_sessions}
                min={1}
                max={50}
                className="w-28 px-3 py-2 text-sm bg-bg-base border border-border rounded-lg text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <p className="text-xs text-fg-secondary mt-1.5">
                When a user opens a new session beyond this limit, the oldest session is evicted.
                Range: 1–50.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors"
          >
            Save security settings
          </button>
        </div>
      </form>
    </div>
  )
}
