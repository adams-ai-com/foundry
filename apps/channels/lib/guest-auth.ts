import { cookies } from 'next/headers'
import db from '@/lib/db'

export type GuestSession = {
  guestId: string
  orgId: string
  name: string
  email: string
  allowedTopicIds: string[]
  allowedChannelIds: string[]
}

export async function getGuestSession(): Promise<GuestSession | null> {
  const jar = await cookies()
  const token = jar.get('foundry_connect_token')?.value
  if (!token) return null

  const rows = await db`
    SELECT
      s.guest_id,
      g.org_id,
      g.name,
      g.email,
      a.topic_id,
      a.channel_id
    FROM channel_connect_sessions s
    JOIN channel_connect_guests g ON g.id = s.guest_id
    JOIN channel_connect_access a ON a.guest_id = s.guest_id AND a.revoked_at IS NULL
    WHERE s.token = ${token} AND s.expires_at > now()
  `

  if (!rows.length) return null

  type Row = { guest_id: string; org_id: string; name: string; email: string; topic_id: string; channel_id: string }
  const typed = rows as unknown as Row[]
  const first = typed[0]

  return {
    guestId:          first.guest_id,
    orgId:            first.org_id,
    name:             first.name,
    email:            first.email,
    allowedTopicIds:  typed.map(r => r.topic_id),
    allowedChannelIds: [...new Set(typed.map(r => r.channel_id))],
  }
}
