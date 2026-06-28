import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import {
  generateDkimKeys,
  updateDmarcPolicy,
  checkEmailDns,
} from '@/lib/admin-actions'

export const dynamic = 'force-dynamic'

const FOUNDRY_MAIL_IP = '142.93.61.78'

function dkimPublicKeyToTxt(pem: string): string {
  return pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\n/g, '')
    .trim()
}

type RecordRowProps = {
  label: string
  host: string
  type: string
  value: string
}

function RecordRow({ label, host, type, value }: RecordRowProps) {
  return (
    <div className="mt-3 p-4 bg-bg-base border border-border rounded-lg">
      <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-2">{label}</p>
      <div className="space-y-1.5 font-mono text-xs">
        <div className="flex gap-2">
          <span className="text-fg-tertiary w-14 shrink-0">Host</span>
          <span className="text-fg-primary select-all">{host}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-fg-tertiary w-14 shrink-0">Type</span>
          <span className="text-fg-primary">{type}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-fg-tertiary w-14 shrink-0">Value</span>
          <span className="text-fg-primary select-all break-all">{value}</span>
        </div>
      </div>
    </div>
  )
}

export default async function DomainDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ msg?: string; err?: string }>
}) {
  const session = await requireAdmin()
  const { id } = await params
  const sp = await searchParams

  const rows = await db`
    SELECT d.id, d.domain, d.verified_at,
           ec.dkim_selector, ec.dkim_public_key, ec.dmarc_policy
    FROM domains d
    LEFT JOIN domain_email_config ec ON ec.domain_id = d.id
    WHERE d.id = ${id} AND d.org_id = ${session.orgId!}
  `
  if (!rows.length) notFound()

  const d = rows[0] as {
    id: string
    domain: string
    verified_at: string | null
    dkim_selector: string | null
    dkim_public_key: string | null
    dmarc_policy: string | null
  }

  const dkimSelector = d.dkim_selector ?? 'foundry'
  const spfRecord   = `v=spf1 ip4:${FOUNDRY_MAIL_IP} ~all`
  const dmarcPolicy = d.dmarc_policy ?? 'none'
  const dmarcRecord = `v=DMARC1; p=${dmarcPolicy}; rua=mailto:dmarc@${d.domain}`
  const dkimTxtValue = d.dkim_public_key
    ? `v=DKIM1; k=rsa; p=${dkimPublicKeyToTxt(d.dkim_public_key)}`
    : null

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/admin/domains" className="text-sm text-fg-secondary hover:text-fg-primary transition-colors">
          ← Domains
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">{d.domain}</h1>
          <p className="text-sm text-fg-secondary mt-1">Email authentication setup wizard</p>
        </div>
        {!d.verified_at && (
          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 font-medium border border-amber-500/20">
            Verify domain ownership first
          </span>
        )}
      </div>

      {sp.msg && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm">
          {decodeURIComponent(sp.msg)}
        </div>
      )}
      {sp.err && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 text-sm">
          {decodeURIComponent(sp.err)}
        </div>
      )}

      {!d.verified_at && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
          Complete domain ownership verification on the{' '}
          <Link href="/admin/domains" className="underline">domains page</Link>{' '}
          before configuring email authentication.
        </div>
      )}

      <div className="space-y-6">
        {/* SPF */}
        <div className="bg-bg-raised border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h2 className="text-sm font-semibold text-fg-primary">SPF</h2>
              <p className="text-xs text-fg-secondary mt-0.5">
                Declares which mail servers are authorised to send email for your domain.
              </p>
            </div>
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium shrink-0">Step 1</span>
          </div>
          <RecordRow
            label="Add this TXT record"
            host={d.domain}
            type="TXT"
            value={spfRecord}
          />
          <p className="text-xs text-fg-tertiary mt-2">
            If you already have an SPF record, add <code className="font-mono">ip4:{FOUNDRY_MAIL_IP}</code> to the existing mechanisms rather than creating a second record.
          </p>
        </div>

        {/* DKIM */}
        <div className="bg-bg-raised border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h2 className="text-sm font-semibold text-fg-primary">DKIM</h2>
              <p className="text-xs text-fg-secondary mt-0.5">
                Cryptographically signs outbound mail so receivers can verify it wasn&apos;t tampered with.
              </p>
            </div>
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium shrink-0">Step 2</span>
          </div>

          {dkimTxtValue ? (
            <>
              <RecordRow
                label="Add this TXT record"
                host={`${dkimSelector}._domainkey.${d.domain}`}
                type="TXT"
                value={dkimTxtValue}
              />
              <p className="text-xs text-fg-tertiary mt-2">
                Selector: <code className="font-mono">{dkimSelector}</code>.
                The private key is stored on the OWL mail server and used to sign outbound messages.
              </p>
              <form action={generateDkimKeys.bind(null, d.id)} className="mt-3">
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 font-medium bg-bg-base hover:bg-bg-hover border border-border text-fg-secondary hover:text-fg-primary rounded-lg transition-colors"
                >
                  Regenerate keys
                </button>
              </form>
            </>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-fg-secondary mb-3">
                No DKIM keys generated yet. Generate a 2048-bit RSA key pair — the private key stays on the
                mail server and the public key goes in DNS.
              </p>
              <form action={generateDkimKeys.bind(null, d.id)}>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors"
                >
                  Generate DKIM keys
                </button>
              </form>
            </div>
          )}
        </div>

        {/* DMARC */}
        <div className="bg-bg-raised border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h2 className="text-sm font-semibold text-fg-primary">DMARC</h2>
              <p className="text-xs text-fg-secondary mt-0.5">
                Tells receiving servers what to do with mail that fails SPF or DKIM checks.
              </p>
            </div>
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium shrink-0">Step 3</span>
          </div>

          <form action={updateDmarcPolicy.bind(null, d.id)} className="mt-3 flex items-center gap-3">
            <select
              name="dmarc_policy"
              defaultValue={dmarcPolicy}
              className="px-3 py-2 text-sm bg-bg-base border border-border rounded-lg text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="none">none — monitor only (recommended to start)</option>
              <option value="quarantine">quarantine — send failures to spam</option>
              <option value="reject">reject — block failing messages</option>
            </select>
            <button
              type="submit"
              className="px-3 py-2 text-sm font-medium bg-bg-base hover:bg-bg-hover border border-border text-fg-secondary hover:text-fg-primary rounded-lg transition-colors whitespace-nowrap"
            >
              Save policy
            </button>
          </form>

          <RecordRow
            label="Add this TXT record"
            host={`_dmarc.${d.domain}`}
            type="TXT"
            value={dmarcRecord}
          />
        </div>

        {/* Check DNS */}
        <div className="flex justify-end">
          <form action={checkEmailDns.bind(null, d.id)}>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors"
            >
              Check all DNS records
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
