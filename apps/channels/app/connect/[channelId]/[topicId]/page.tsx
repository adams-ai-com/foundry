import { redirect } from 'next/navigation'
import { getGuestSession } from '@/lib/guest-auth'
import db from '@/lib/db'
import { GuestShell } from '@/components/GuestShell'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ channelId: string; topicId: string }> }

type Reaction = { emoji: string; user_ids: string[] }
type Message = {
  id: string; author_id: string; author_name: string; author_email: string
  body: string; reactions: Reaction[]; edited_at: string | null; created_at: string; is_guest: boolean
}

export default async function GuestWorkspacePage({ params }: Props) {
  const { channelId, topicId } = await params

  const guest = await getGuestSession()
  if (!guest) redirect('/connect')
  if (!guest.allowedTopicIds.includes(topicId)) redirect('/connect')

  const [topic] = await db`
    SELECT t.id, t.name, c.name as channel_name
    FROM channel_topics t
    JOIN channels c ON c.id = t.channel_id
    WHERE t.id = ${topicId} AND t.channel_id = ${channelId}
      AND c.org_id = ${guest.orgId}
  ` as unknown as [{ id: string; name: string; channel_name: string }?]

  if (!topic) redirect('/connect')

  const rows = await db`
    SELECT id, author_id, author_name, author_email, body, reactions,
           edited_at, created_at, is_guest
    FROM channel_messages
    WHERE topic_id = ${topicId} AND channel_id = ${channelId}
      AND org_id = ${guest.orgId} AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 100
  `

  return (
    <GuestShell
      guestId={guest.guestId}
      guestName={guest.name}
      guestEmail={guest.email}
      channelId={channelId}
      topicId={topicId}
      channelName={topic.channel_name}
      topicName={topic.name}
      initialMessages={rows as unknown as Message[]}
    />
  )
}
