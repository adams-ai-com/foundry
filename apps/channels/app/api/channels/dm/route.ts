import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dms = await db`
    SELECT c.id, c.metadata,
      t.id as topic_id,
      t.last_message_at
    FROM channels c
    JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ${session.userId}
    LEFT JOIN channel_topics t ON t.channel_id = c.id
    WHERE c.org_id = ${session.orgId} AND c.type = 'dm' AND c.is_archived = false
    ORDER BY t.last_message_at DESC NULLS LAST
  `

  return NextResponse.json(dms)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recipientId, recipientName } = await req.json() as { recipientId: string; recipientName: string }
  if (!recipientId || recipientId === session.userId) {
    return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 })
  }

  const dmName = [session.userId, recipientId].sort().join('::')
  const authorName = session.name ?? session.email.split('@')[0]

  const [existing] = await db`
    SELECT c.id, t.id as topic_id
    FROM channels c
    LEFT JOIN channel_topics t ON t.channel_id = c.id
    WHERE c.org_id = ${session.orgId} AND c.name = ${dmName} AND c.type = 'dm'
    LIMIT 1
  `
  if (existing) {
    return NextResponse.json({ channelId: existing.id, topicId: existing.topic_id })
  }

  const metadata = {
    participants: [
      { id: session.userId, name: authorName, email: session.email },
      { id: recipientId, name: recipientName },
    ],
  }

  const [channel] = await db`
    INSERT INTO channels (org_id, name, type, created_by, metadata)
    VALUES (${session.orgId}, ${dmName}, 'dm', ${session.userId}, ${JSON.stringify(metadata)}::jsonb)
    RETURNING id
  `

  const [topic] = await db`
    INSERT INTO channel_topics (channel_id, org_id, name, created_by)
    VALUES (${channel.id}, ${session.orgId}, 'dm', ${session.userId})
    RETURNING id
  `

  await db`
    INSERT INTO channel_members (channel_id, user_id)
    VALUES (${channel.id}, ${session.userId}), (${channel.id}, ${recipientId})
    ON CONFLICT DO NOTHING
  `

  return NextResponse.json({ channelId: channel.id, topicId: topic.id }, { status: 201 })
}
