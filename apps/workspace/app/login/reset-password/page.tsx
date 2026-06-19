import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AuthShell } from '@/components/AuthShell'
import { ResetPasswordForm } from '@/components/ResetPasswordForm'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.mustResetPassword) redirect('/')

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
            Set your password
          </h1>
          <p className="text-sm text-fg-secondary leading-relaxed">
            Choose a new password to continue.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </AuthShell>
  )
}
