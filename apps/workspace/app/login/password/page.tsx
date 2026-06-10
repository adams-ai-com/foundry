import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AuthShell } from '@/components/AuthShell'
import { PasswordForm } from '@/components/PasswordForm'

export const dynamic = 'force-dynamic'

export default async function PasswordPage() {
  const jar = await cookies()
  const email = jar.get('foundry_login_email')?.value
  if (!email) redirect('/login')

  return (
    <AuthShell>
      <div>
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
                 strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-accent">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-fg-primary tracking-tight mb-2">
            Sign in to Foundry
          </h1>
          <p className="text-sm text-fg-secondary leading-relaxed">
            Enter your password to continue.
          </p>
        </div>

        <PasswordForm email={email} />

        <p className="mt-6 text-center text-[11.5px] text-fg-tertiary leading-relaxed">
          By signing in you agree to keep your access credentials private.
        </p>
      </div>
    </AuthShell>
  )
}
