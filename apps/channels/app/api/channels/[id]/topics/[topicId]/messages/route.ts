import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'
import { broadcastToOrg } from '@/lib/sse'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; topicId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, topicId } = await params

  const rows = await db`
    SELECT id, author_id, author_name, author_email, body, reactions, edited_at, created_at
    FROM channel_messages
    WHERE topic_id = ${topicId} AND channel_id = ${id} AND org_id = ${session.orgId}
      AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 100
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, topicId } = await params
  const { body } = await req.json() as { body: string }
  if (!body?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const [topic] = await db`
    SELECT t.id FROM channel_topics t
    JOIN channels c ON c.id = t.channel_id
    WHERE t.id = ${topicId} AND t.channel_id = ${id} AND c.org_id = ${session.orgId}
  `
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const authorName = session.name ?? session.email.split('@')[0]

  const [message] = await db`
    INSERT INTO channel_messages
      (channel_id, topic_id, org_id, author_id, author_name, author_email, body)
    VALUES
      (${id}, ${topicId}, ${session.orgId}, ${session.userId}, ${authorName}, ${session.email}, ${body.trim()})
    RETURNING id, author_id, author_name, author_email, body, reactions, edited_at, created_at
  `

  await db`
    UPDATE channel_topics
    SET last_message_at = now(), message_count = message_count + 1
    WHERE id = ${topicId}
  `

  broadcastToOrg(session.orgId, {
    type:      'message:new',
    channelId: id,
    topicId,
    message,
  })

  return NextResponse.json(message, { status: 201 })
}
