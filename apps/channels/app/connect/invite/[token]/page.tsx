import { redirect } from 'next/navigation'
import db from '@/lib/db'
import { AcceptForm } from './AcceptForm'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ token: string }> }

export default async function AcceptInvitePage({ params }: Props) {
  const { token } = await params

  const [invite] = await db`
    SELECT
      i.id, i.email, i.name, i.used_at, i.expires_at,
      t.name as topic_name,
      c.name as channel_name
    FROM channel_connect_invites i
    JOIN channel_topics t ON t.id = i.topic_id
    JOIN channels c ON c.id = i.channel_id
    WHERE i.token = ${token} AND i.expires_at > now()
  ` as unknown as [{
    id: string; email: string; name: string | null; used_at: string | null;
    expires_at: string; topic_name: string; channel_name: string
  }?]

  if (!invite) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-danger">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-fg-primary mb-2">Invite not found</h1>
          <p className="text-sm text-fg-secondary">This invite link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  if (invite.used_at) {
    redirect(`/connect`)
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-accent-fg">
              <path d="M4 5a1 1 0 011-1h14a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h6a1 1 0 010 2H5a1 1 0 01-1-1z"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-fg-primary">You&apos;ve been invited</h1>
          <p className="text-sm text-fg-secondary mt-2">
            Join the discussion in{' '}
            <span className="font-medium text-fg-primary">#{invite.channel_name}</span>
            {' › '}
            <span className="font-medium text-fg-primary">{invite.topic_name}</span>
          </p>
        </div>

        <AcceptForm
          token={token}
          email={invite.email}
          defaultName={invite.name ?? invite.email.split('@')[0]}
        />
      </div>
    </div>
  )
}
