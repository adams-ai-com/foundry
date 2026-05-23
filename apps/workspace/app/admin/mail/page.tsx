import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import mailDb from '@/lib/mailDb'
import { updateSmtpConfig } from '@/lib/admin-actions'

export const dynamic = 'force-dynamic'

type SmtpConfig = {
  hostname: string | null
  inbound_port: number
  tls_mode: 'none' | 'starttls' | 'tls'
  relay_enabled: boolean
  relay_host: string | null
  relay_port: number
  relay_username: string | null
  relay_password: string | null
  from_address: string | null
  from_name: string | null
  updated_at: string | null
}

type DeliveryStats = {
  sent_24h: number
  sent_7d: number
  sent_30d: number
  failed_24h: number
  failed_7d: number
  failed_30d: number
}

type RecentFailure = {
  from_email: string
  to_count: number
  error: string | null
  sent_at: string
}

type VolumeStats = {
  received_24h: number
  received_7d: number
  received_30d: number
  outbound_24h: number
  outbound_7d: number
  outbound_30d: number
}

const DEFAULTS: SmtpConfig = {
  hostname: null,
  inbound_port: 25,
  tls_mode: 'starttls',
  relay_enabled: false,
  relay_host: null,
  relay_port: 587,
  relay_username: null,
  relay_password: null,
  from_address: null,
  from_name: null,
  updated_at: null,
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-fg-primary mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-fg-tertiary mt-1.5">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40'
const selectCls = 'px-3 py-2 text-sm bg-bg-base border border-border rounded-lg text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent/40'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-bg-base border border-border rounded-lg px-3 py-2.5">
      <div className="text-xs text-fg-tertiary">{label}</div>
      <div className="text-lg font-bold text-fg-primary mt-0.5">{value}</div>
      {sub && <div className="text-xs text-fg-tertiary">{sub}</div>}
    </div>
  )
}

function successRate(sent: number, failed: number): string {
  const total = sent + failed
  if (total === 0) return '—'
  return `${Math.round((sent / total) * 100)}%`
}

function timeAgo(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export default async function MailAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>
}) {
  const session = await requireAdmin()
  const params = await searchParams

  const rows = await db`SELECT * FROM smtp_config WHERE org_id = ${session.orgId!}`
  const cfg: SmtpConfig = rows.length ? rows[0] as unknown as SmtpConfig : DEFAULTS

  // Message volume from foundry_mail
  const [volRows, deliveryRows, failureRows] = await Promise.all([
    mailDb`
      SELECT
        COUNT(*) FILTER (WHERE mb.type != 'sent' AND m.received_at > NOW() - INTERVAL '24 hours') AS received_24h,
        COUNT(*) FILTER (WHERE mb.type != 'sent' AND m.received_at > NOW() - INTERVAL '7 days')  AS received_7d,
        COUNT(*) FILTER (WHERE mb.type != 'sent' AND m.received_at > NOW() - INTERVAL '30 days') AS received_30d,
        COUNT(*) FILTER (WHERE mb.type = 'sent'  AND m.received_at > NOW() - INTERVAL '24 hours') AS outbound_24h,
        COUNT(*) FILTER (WHERE mb.type = 'sent'  AND m.received_at > NOW() - INTERVAL '7 days')  AS outbound_7d,
        COUNT(*) FILTER (WHERE mb.type = 'sent'  AND m.received_at > NOW() - INTERVAL '30 days') AS outbound_30d
      FROM messages m
      JOIN mailboxes mb ON mb.id = m.mailbox_id
    `,
    mailDb`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent'   AND sent_at > NOW() - INTERVAL '24 hours') AS sent_24h,
        COUNT(*) FILTER (WHERE status = 'sent'   AND sent_at > NOW() - INTERVAL '7 days')   AS sent_7d,
        COUNT(*) FILTER (WHERE status = 'sent'   AND sent_at > NOW() - INTERVAL '30 days')  AS sent_30d,
        COUNT(*) FILTER (WHERE status = 'failed' AND sent_at > NOW() - INTERVAL '24 hours') AS failed_24h,
        COUNT(*) FILTER (WHERE status = 'failed' AND sent_at > NOW() - INTERVAL '7 days')   AS failed_7d,
        COUNT(*) FILTER (WHERE status = 'failed' AND sent_at > NOW() - INTERVAL '30 days')  AS failed_30d
      FROM mail_delivery_log
    `,
    mailDb`
      SELECT from_email, to_count, error, sent_at
      FROM mail_delivery_log
      WHERE status = 'failed'
      ORDER BY sent_at DESC
      LIMIT 10
    `,
  ])

  const vol = volRows[0] as unknown as VolumeStats
  const delivery = deliveryRows[0] as unknown as DeliveryStats
  const failures = failureRows as unknown as RecentFailure[]

  const MAIL_SERVER_IP = '142.93.61.78'
  const MAIL_SERVER_PORT = 3100

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-fg-primary">Mail Admin</h1>
        <p className="text-sm text-fg-secondary mt-1">
          Configure SMTP server settings, TLS, and outbound relay.
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

      {/* Live server info */}
      <div className="bg-bg-raised border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-fg-primary mb-3">Foundry mail server</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Host',    value: MAIL_SERVER_IP },
            { label: 'Port',    value: String(MAIL_SERVER_PORT) },
            { label: 'Service', value: 'foundry-mail.service' },
            { label: 'Status',  value: 'Running' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-bg-base border border-border rounded-lg px-3 py-2">
              <div className="text-xs text-fg-tertiary">{label}</div>
              <div className={`text-xs font-mono mt-0.5 ${label === 'Status' ? 'text-emerald-600' : 'text-fg-primary'}`}>
                {value}
              </div>
            </div>
          ))}
        </div>
        {cfg.updated_at && (
          <p className="text-xs text-fg-tertiary mt-3">
            Config last saved: {new Date(cfg.updated_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Health stats */}
      <div className="bg-bg-raised border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-fg-primary mb-4">Server health</h2>

        <div className="mb-4">
          <div className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide mb-2">Message volume</div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Received 24h" value={Number(vol.received_24h)} />
            <StatCard label="Received 7d"  value={Number(vol.received_7d)} />
            <StatCard label="Received 30d" value={Number(vol.received_30d)} />
            <StatCard label="Sent 24h" value={Number(vol.outbound_24h)} />
            <StatCard label="Sent 7d"  value={Number(vol.outbound_7d)} />
            <StatCard label="Sent 30d" value={Number(vol.outbound_30d)} />
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide mb-2">Delivery success rate</div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Last 24h"
              value={successRate(Number(delivery.sent_24h), Number(delivery.failed_24h))}
              sub={`${Number(delivery.sent_24h)} sent · ${Number(delivery.failed_24h)} failed`}
            />
            <StatCard
              label="Last 7 days"
              value={successRate(Number(delivery.sent_7d), Number(delivery.failed_7d))}
              sub={`${Number(delivery.sent_7d)} sent · ${Number(delivery.failed_7d)} failed`}
            />
            <StatCard
              label="Last 30 days"
              value={successRate(Number(delivery.sent_30d), Number(delivery.failed_30d))}
              sub={`${Number(delivery.sent_30d)} sent · ${Number(delivery.failed_30d)} failed`}
            />
          </div>
        </div>

        {failures.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide mb-2">Recent failures</div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 divide-y divide-red-500/10 overflow-hidden">
              {failures.map((f, i) => (
                <div key={i} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-fg-primary">{f.from_email}</span>
                    <span className="text-xs text-fg-tertiary whitespace-nowrap">{timeAgo(f.sent_at)}</span>
                  </div>
                  {f.error && (
                    <p className="text-xs text-red-600 mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">{f.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {failures.length === 0 && (Number(delivery.sent_30d) + Number(delivery.failed_30d)) === 0 && (
          <p className="text-xs text-fg-tertiary">No outbound delivery activity yet. Stats will appear as mail is sent.</p>
        )}
      </div>

      <form action={updateSmtpConfig} className="space-y-6">

        {/* Server identity */}
        <div className="bg-bg-raised border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-fg-primary mb-5">Server identity</h2>
          <div className="space-y-4">
            <Field
              label="Mail server hostname"
              hint="The FQDN your mail server announces in HELO/EHLO. Should match a valid PTR record. E.g. mail.example.com"
            >
              <input
                type="text"
                name="hostname"
                defaultValue={cfg.hostname ?? ''}
                placeholder="mail.example.com"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Inbound SMTP port" hint="Standard: 25 (direct), 587 (submission)">
                <input
                  type="number"
                  name="inbound_port"
                  defaultValue={cfg.inbound_port}
                  min={1}
                  max={65535}
                  className={inputCls}
                />
              </Field>

              <Field label="TLS mode" hint="STARTTLS upgrades a plain connection; TLS requires TLS from the start">
                <select name="tls_mode" defaultValue={cfg.tls_mode} className={`w-full ${selectCls}`}>
                  <option value="none">None (plaintext)</option>
                  <option value="starttls">STARTTLS (recommended)</option>
                  <option value="tls">TLS / SSL</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* From address */}
        <div className="bg-bg-raised border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-fg-primary mb-5">Default sender</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="From address" hint="E.g. noreply@example.com">
              <input
                type="email"
                name="from_address"
                defaultValue={cfg.from_address ?? ''}
                placeholder="noreply@example.com"
                className={inputCls}
              />
            </Field>
            <Field label="From name" hint="Display name shown in email clients">
              <input
                type="text"
                name="from_name"
                defaultValue={cfg.from_name ?? ''}
                placeholder="Foundry"
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* Outbound relay */}
        <div className="bg-bg-raised border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-fg-primary mb-2">Outbound relay</h2>
          <p className="text-xs text-fg-secondary mb-5">
            Route outbound mail through an external SMTP relay (e.g. Mailgun, SendGrid, SES).
            Leave disabled to send directly from the Foundry mail server.
          </p>

          <label className="flex items-center gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              name="relay_enabled"
              defaultChecked={cfg.relay_enabled}
              className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
            />
            <span className="text-sm font-medium text-fg-primary">Enable outbound relay</span>
          </label>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field label="Relay host" hint="SMTP relay hostname">
                  <input
                    type="text"
                    name="relay_host"
                    defaultValue={cfg.relay_host ?? ''}
                    placeholder="smtp.mailgun.org"
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Relay port" hint="">
                <input
                  type="number"
                  name="relay_port"
                  defaultValue={cfg.relay_port}
                  min={1}
                  max={65535}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Username">
                <input
                  type="text"
                  name="relay_username"
                  defaultValue={cfg.relay_username ?? ''}
                  placeholder="postmaster@mg.example.com"
                  autoComplete="off"
                  className={inputCls}
                />
              </Field>
              <Field label="Password" hint={cfg.relay_password ? 'Leave blank to keep existing' : ''}>
                <input
                  type="password"
                  name="relay_password"
                  placeholder={cfg.relay_password ? '••••••••' : 'Enter password'}
                  autoComplete="new-password"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors"
          >
            Save SMTP configuration
          </button>
        </div>
      </form>
    </div>
  )
}
