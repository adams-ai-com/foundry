import Link from 'next/link'
import { requireSession } from '@foundry/auth'
import db from '@/lib/db'
import { CallRoom } from './CallRoom'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ callId: string }> }

export default async function CallPage({ params }: Props) {
  const { callId } = await params
  const session = await requireSession()

  const [call] = await db`
    SELECT id, title, status, channel_id, topic_id, created_by, livekit_room_name
    FROM video_calls
    WHERE id = ${callId} AND org_id = ${session.orgId}
  ` as unknown as [{
    id: string; title: string; status: string
    channel_id: string | null; topic_id: string | null
    created_by: string; livekit_room_name: string
  }?]

  if (!call || call.status === 'ended') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/30">
              <path d="M0 5a2 2 0 012-2h7.5a2 2 0 011.983 1.738l3.11-1.382A1 1 0 0116 4.269v7.462a1 1 0 01-1.406.913l-3.111-1.382A2 2 0 019.5 13H2a2 2 0 01-2-2V5z"/>
            </svg>
          </div>
          <p className="text-white text-sm font-medium mb-1">Call ended</p>
          <p className="text-white/40 text-xs mb-4">This call is no longer active.</p>
          <Link href="/" className="text-xs text-white/30 hover:text-white/50 underline">
            Return to Foundry
          </Link>
        </div>
      </div>
    )
  }

  return (
    <CallRoom
      callId={call.id}
      title={call.title}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL ?? ''}
      channelId={call.channel_id}
      topicId={call.topic_id}
      isCreator={call.created_by === session.userId}
    />
  )
}
