import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth'
import { AuthShell } from '@/components/AuthShell'
import { LoginForm } from '@/components/LoginForm'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getOrgFromHost(host: string): Promise<{ name: string } | null> {
  // Strip port if present
  const bare = host.split(':')[0].toLowerCase()
  // Skip localhost and the default foundry domain
  if (bare === 'localhost' || bare.endsWith('.adams-ai.com')) return null

  const rows = await db`
    SELECT o.name FROM domains d
    JOIN orgs o ON o.id = d.org_id
    WHERE d.domain = ${bare} AND d.verified_at IS NOT NULL
    LIMIT 1
  `
  return (rows[0] as { name: string }) ?? null
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await getSession()
  if (session) redirect('/')

  const hdrs = await headers()
  const host = hdrs.get('host') ?? ''
  const org = await getOrgFromHost(host)
  const sp = await searchParams
  const urlError = sp.err ?? null

  const heading = org ? `Sign in to ${org.name}` : 'Sign in to OpenWork Loft'
  const subheading = 'Enter your email address to continue.'

  return (
    <AuthShell>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-fg-primary tracking-tight mb-2">
            {heading}
          </h1>
          <p className="text-sm text-fg-secondary leading-relaxed">
            {subheading}
          </p>
        </div>

        <LoginForm urlError={urlError} />

        <p className="mt-6 text-center text-[11.5px] text-fg-tertiary leading-relaxed">
          By signing in you agree to keep your access credentials private.
        </p>
      </div>
    </AuthShell>
  )
}
