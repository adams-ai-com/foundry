import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyEmailCode } from '@/lib/actions'
import { AuthShell } from '@/components/AuthShell'
import { TotpForm } from '@/components/TotpForm'

export const dynamic = 'force-dynamic'

export default async function VerifyPage() {
  const jar = await cookies()
  const email = jar.get('foundry_login_email')?.value
  if (!email) redirect('/login')

  const masked = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 4)) + c)

  return (
    <AuthShell>
      <div>
        <div className="mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
                 strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-accent">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-fg-primary tracking-tight mb-2">
            Check your email
          </h1>
          <p className="text-sm text-fg-secondary leading-relaxed">
            We sent a 6-digit code to <span className="font-medium text-fg-primary">{masked}</span>.
            Enter it below to sign in.
          </p>
        </div>

        <TotpForm action={verifyEmailCode} buttonLabel="Sign in" />

        <div className="mt-5 text-center">
          <a href="/login" className="text-xs text-fg-tertiary hover:text-fg-secondary transition-colors">
            ← Use a different email
          </a>
        </div>
      </div>
    </AuthShell>
  )
}
