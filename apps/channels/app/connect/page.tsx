import { redirect } from 'next/navigation'
import { getGuestSession } from '@/lib/guest-auth'

export const dynamic = 'force-dynamic'

export default async function ConnectPage() {
  const guest = await getGuestSession()

  if (guest && guest.allowedTopicIds.length > 0) {
    redirect(`/connect/${guest.allowedChannelIds[0]}/${guest.allowedTopicIds[0]}`)
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-bg-surface border border-border rounded-full flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-fg-tertiary">
            <path d="M4 5a1 1 0 011-1h14a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h6a1 1 0 010 2H5a1 1 0 01-1-1z"/>
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-fg-primary mb-2">No active session</h1>
        <p className="text-sm text-fg-secondary">Request an invite link from the person who invited you.</p>
      </div>
    </div>
  )
}
