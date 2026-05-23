import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { updateOrgAppDefaults } from '@/lib/admin-actions'

export const dynamic = 'force-dynamic'

const ALL_APPS = [
  { id: 'docs',   label: 'Docs',   desc: 'Rich text documents, reports, and notes' },
  { id: 'sheets', label: 'Sheets', desc: 'Spreadsheets, data models, and formulas' },
  { id: 'mail',   label: 'Mail',   desc: 'Email, channels, and messaging' },
  { id: 'wiki',   label: 'Wiki',   desc: 'Nested knowledge base for your team' },
] as const

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>
}) {
  const session = await requireAdmin()
  const params = await searchParams

  // Load org defaults — no row means enabled
  const defaultRows = await db`
    SELECT app, enabled FROM org_app_defaults WHERE org_id = ${session.orgId!}
  ` as unknown as Array<{ app: string; enabled: boolean }>

  const defaults = Object.fromEntries(
    ALL_APPS.map(a => {
      const row = defaultRows.find(r => r.app === a.id)
      return [a.id, row ? row.enabled : true]
    })
  ) as Record<string, boolean>

  // Count per-user overrides to show context
  const overrideCount = await db`
    SELECT COUNT(DISTINCT user_id)::int AS n
    FROM user_app_access WHERE org_id = ${session.orgId!}
  ` as unknown as Array<{ n: number }>
  const usersWithOverrides = overrideCount[0]?.n ?? 0

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-fg-primary">App Access</h1>
        <p className="text-sm text-fg-secondary mt-1">
          Set which apps are available to new members by default.
          Individual users can be overridden from their profile page.
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

      {/* Default access */}
      <div className="bg-bg-raised border border-border rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-fg-primary mb-1">Default access for new members</h2>
        <p className="text-xs text-fg-secondary mb-5">
          These settings apply when a user accepts an invitation. Changing them here does{' '}
          <strong>not</strong> retroactively update existing members.
        </p>

        <form action={updateOrgAppDefaults} className="space-y-3">
          {ALL_APPS.map(app => (
            <label key={app.id} className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg hover:bg-bg-hover transition-colors">
              <input
                type="checkbox"
                name={`app_${app.id}`}
                defaultChecked={defaults[app.id]}
                className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer"
              />
              <div>
                <div className="text-sm font-medium text-fg-primary">{app.label}</div>
                <div className="text-xs text-fg-secondary mt-0.5">{app.desc}</div>
              </div>
            </label>
          ))}

          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors"
            >
              Save defaults
            </button>
          </div>
        </form>
      </div>

      {/* Per-user override context */}
      <div className="bg-bg-raised border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-fg-primary mb-1">Per-user overrides</h2>
        <p className="text-xs text-fg-secondary">
          {usersWithOverrides === 0
            ? 'No users have individual app access overrides yet.'
            : `${usersWithOverrides} ${usersWithOverrides === 1 ? 'user has' : 'users have'} individual app access overrides.`}{' '}
          To change access for a specific user, open their profile from the{' '}
          <a href="/admin/users" className="text-accent hover:underline">Users</a> page.
        </p>
      </div>
    </div>
  )
}
