import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { NewOrgForm } from '@/components/NewOrgForm'

export const dynamic = 'force-dynamic'

export default async function NewOrgPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-bg-base relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent mb-4 shadow-md">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-accent-fg" aria-hidden="true">
              <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h10a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h6a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1z"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-fg-primary tracking-tight">Create workspace</h1>
          <p className="text-fg-secondary text-sm mt-0.5">{session.email}</p>
        </div>
        <div className="bg-bg-raised rounded-xl border border-border shadow-card p-7">
          <h2 className="text-sm font-semibold text-fg-primary mb-0.5">Name your organization</h2>
          <p className="text-fg-secondary text-xs mb-5">Your company or team name.</p>
          <NewOrgForm />
        </div>
      </div>
    </div>
  )
}
