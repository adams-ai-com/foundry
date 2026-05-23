import { NextRequest, NextResponse } from 'next/server'
import { getGuestSession } from '@/lib/guest-auth'
import db from '@/lib/db'
import { broadcastToOrg } from '@/lib/sse'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ channelId: string; topicId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const guest = await getGuestSession()
  if (!guest) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channelId, topicId } = await params
  if (!guest.allowedTopicIds.includes(topicId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db`
    SELECT id, author_id, author_name, author_email, body, reactions,
           edited_at, created_at, is_guest
    FROM channel_messages
    WHERE topic_id = ${topicId} AND channel_id = ${channelId}
      AND org_id = ${guest.orgId} AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 100
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: Params) {
  const guest = await getGuestSession()
  if (!guest) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channelId, topicId } = await params
  if (!guest.allowedTopicIds.includes(topicId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { body } = await req.json() as { body: string }
  if (!body?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const [message] = await db`
    INSERT INTO channel_messages
      (channel_id, topic_id, org_id, author_id, author_name, author_email, body, is_guest)
    VALUES
      (${channelId}, ${topicId}, ${guest.orgId}, ${guest.guestId},
       ${guest.name}, ${guest.email}, ${body.trim()}, true)
    RETURNING id, author_id, author_name, author_email, body, reactions,
              edited_at, created_at, is_guest
  `

  await db`
    UPDATE channel_topics
    SET last_message_at = now(), message_count = message_count + 1
    WHERE id = ${topicId}
  `

  broadcastToOrg(guest.orgId, {
    type:      'message:new',
    channelId,
    topicId,
    message,
  })

  return NextResponse.json(message, { status: 201 })
}
