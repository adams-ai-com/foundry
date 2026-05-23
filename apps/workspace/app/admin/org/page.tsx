import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { updateOrgProfile } from '@/lib/admin-actions'

export const dynamic = 'force-dynamic'

const TIMEZONES: { group: string; zones: { value: string; label: string }[] }[] = [
  { group: 'UTC', zones: [
    { value: 'UTC', label: 'UTC' },
  ]},
  { group: 'Americas', zones: [
    { value: 'America/New_York',    label: 'Eastern Time (US & Canada)' },
    { value: 'America/Chicago',     label: 'Central Time (US & Canada)' },
    { value: 'America/Denver',      label: 'Mountain Time (US & Canada)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
    { value: 'America/Anchorage',   label: 'Alaska' },
    { value: 'Pacific/Honolulu',    label: 'Hawaii' },
    { value: 'America/Halifax',     label: 'Atlantic Time (Canada)' },
    { value: 'America/Vancouver',   label: 'Vancouver' },
    { value: 'America/Sao_Paulo',   label: 'Brasilia' },
    { value: 'America/Buenos_Aires',label: 'Buenos Aires' },
    { value: 'America/Mexico_City', label: 'Mexico City' },
    { value: 'America/Bogota',      label: 'Bogota' },
    { value: 'America/Lima',        label: 'Lima' },
    { value: 'America/Santiago',    label: 'Santiago' },
  ]},
  { group: 'Europe', zones: [
    { value: 'Europe/London',       label: 'London' },
    { value: 'Europe/Dublin',       label: 'Dublin' },
    { value: 'Europe/Lisbon',       label: 'Lisbon' },
    { value: 'Europe/Paris',        label: 'Paris' },
    { value: 'Europe/Berlin',       label: 'Berlin' },
    { value: 'Europe/Rome',         label: 'Rome' },
    { value: 'Europe/Madrid',       label: 'Madrid' },
    { value: 'Europe/Amsterdam',    label: 'Amsterdam' },
    { value: 'Europe/Brussels',     label: 'Brussels' },
    { value: 'Europe/Zurich',       label: 'Zurich' },
    { value: 'Europe/Stockholm',    label: 'Stockholm' },
    { value: 'Europe/Helsinki',     label: 'Helsinki' },
    { value: 'Europe/Warsaw',       label: 'Warsaw' },
    { value: 'Europe/Athens',       label: 'Athens' },
    { value: 'Europe/Istanbul',     label: 'Istanbul' },
    { value: 'Europe/Moscow',       label: 'Moscow' },
  ]},
  { group: 'Africa', zones: [
    { value: 'Africa/Cairo',        label: 'Cairo' },
    { value: 'Africa/Lagos',        label: 'Lagos' },
    { value: 'Africa/Nairobi',      label: 'Nairobi' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg' },
  ]},
  { group: 'Asia', zones: [
    { value: 'Asia/Dubai',          label: 'Dubai' },
    { value: 'Asia/Karachi',        label: 'Karachi' },
    { value: 'Asia/Kolkata',        label: 'Mumbai / New Delhi' },
    { value: 'Asia/Dhaka',          label: 'Dhaka' },
    { value: 'Asia/Bangkok',        label: 'Bangkok' },
    { value: 'Asia/Singapore',      label: 'Singapore' },
    { value: 'Asia/Shanghai',       label: 'Beijing / Shanghai' },
    { value: 'Asia/Tokyo',          label: 'Tokyo' },
    { value: 'Asia/Seoul',          label: 'Seoul' },
    { value: 'Asia/Manila',         label: 'Manila' },
  ]},
  { group: 'Pacific & Australia', zones: [
    { value: 'Australia/Perth',     label: 'Perth' },
    { value: 'Australia/Adelaide',  label: 'Adelaide' },
    { value: 'Australia/Sydney',    label: 'Sydney / Melbourne' },
    { value: 'Pacific/Auckland',    label: 'Auckland' },
    { value: 'Pacific/Fiji',        label: 'Fiji' },
  ]},
]

type OrgProfile = {
  name: string
  slug: string
  logo_url: string | null
  timezone: string
  contact_email: string | null
  created_at: string
}

export default async function OrgSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await requireAdmin()
  const sp = await searchParams
  const msg = sp.msg ? decodeURIComponent(sp.msg) : null
  const err = sp.err ? decodeURIComponent(sp.err) : null

  if (!session.orgId) return <div className="p-8 text-fg-secondary">No active organization.</div>

  const rows = await db`
    SELECT name, slug, logo_url, timezone, contact_email, created_at
    FROM orgs WHERE id = ${session.orgId}
  `
  const org = rows[0] as unknown as OrgProfile

  const inputCls = 'w-full px-3 py-2 bg-bg-base border border-border rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60'
  const labelCls = 'block text-sm font-medium text-fg-primary mb-1.5'

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-primary">Org Settings</h1>
        <p className="text-sm text-fg-secondary mt-1">
          Manage your organization profile and regional preferences.
        </p>
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

      <form action={updateOrgProfile} className="space-y-5">

        {/* Identity */}
        <div className="bg-bg-raised border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-fg-primary">Identity</h2>

          <div>
            <label className={labelCls}>Organization name</label>
            <input
              name="name"
              type="text"
              required
              defaultValue={org.name}
              placeholder="Acme Corp"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Logo URL</label>
            <input
              name="logo_url"
              type="url"
              defaultValue={org.logo_url ?? ''}
              placeholder="https://example.com/logo.png"
              className={inputCls}
            />
            <p className="text-xs text-fg-tertiary mt-1">
              Paste a public URL to your logo. PNG or SVG recommended. Leave blank to use initials.
            </p>
            {org.logo_url && (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={org.logo_url}
                  alt="Logo preview"
                  className="h-10 w-auto rounded border border-border object-contain bg-bg-base p-1"
                />
                <span className="text-xs text-fg-tertiary">Current logo</span>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>URL slug</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={org.slug}
                disabled
                readOnly
                className="w-full px-3 py-2 bg-bg-base border border-border rounded-lg text-sm text-fg-tertiary cursor-not-allowed opacity-60"
              />
            </div>
            <p className="text-xs text-fg-tertiary mt-1">
              Slug is set at creation and cannot be changed.
            </p>
          </div>
        </div>

        {/* Regional */}
        <div className="bg-bg-raised border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-fg-primary">Regional</h2>

          <div>
            <label className={labelCls}>Timezone</label>
            <select
              name="timezone"
              defaultValue={org.timezone}
              className={inputCls}
            >
              {TIMEZONES.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.zones.map(z => (
                    <option key={z.value} value={z.value}>{z.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-fg-tertiary mt-1">
              Used for scheduled reports, digests, and date display across the workspace.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-bg-raised border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-fg-primary">Contact</h2>

          <div>
            <label className={labelCls}>Contact email</label>
            <input
              name="contact_email"
              type="email"
              defaultValue={org.contact_email ?? ''}
              placeholder="admin@example.com"
              className={inputCls}
            />
            <p className="text-xs text-fg-tertiary mt-1">
              Used for system notifications and as the reply-to address in outbound mail.
            </p>
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-bg-raised border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-fg-primary mb-3">About this organization</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-fg-tertiary mb-0.5">Org ID</div>
              <div className="text-xs font-mono text-fg-secondary">{session.orgId}</div>
            </div>
            <div>
              <div className="text-xs text-fg-tertiary mb-0.5">Created</div>
              <div className="text-xs text-fg-secondary">
                {new Date(org.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-accent hover:bg-accent-hover text-accent-fg font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            Save changes
          </button>
        </div>

      </form>
    </div>
  )
}
