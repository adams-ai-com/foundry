import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyTotp, startSetup } from '@/lib/actions'
import { AuthShell } from '@/components/AuthShell'
import { TotpForm } from '@/components/TotpForm'

export const dynamic = 'force-dynamic'

export default async function VerifyPage() {
  const jar = await cookies()
  const email = jar.get('foundry_login_email')?.value
  if (!email) redirect('/login')

  return (
    <AuthShell>
      <div>
        {/* Icon badge */}
        <div className="mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
                 strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-accent">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-fg-primary tracking-tight mb-2">
            Two-factor authentication
          </h1>
          <p className="text-sm text-fg-secondary leading-relaxed">
            Open <span className="font-medium text-fg-primary">Microsoft Authenticator</span> and
            enter the 6-digit code for <span className="font-medium text-fg-primary">Foundry</span>.
          </p>
        </div>

        {/* Email chip */}
        <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-bg-surface border border-border">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
               strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-fg-tertiary flex-shrink-0">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <span className="text-xs text-fg-secondary truncate font-mono">{email}</span>
        </div>

        <TotpForm action={verifyTotp} buttonLabel="Sign in" />

        <div className="mt-5 space-y-2">
          <form action={startSetup}>
            <button type="submit" className="w-full text-xs text-fg-tertiary hover:text-fg-secondary transition-colors py-2 hover:bg-bg-surface rounded-lg">
              Need to set up authenticator? →
            </button>
          </form>
          <div className="text-center">
            <a href="/login" className="text-xs text-fg-tertiary hover:text-fg-secondary transition-colors">
              ← Use a different email
            </a>
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
