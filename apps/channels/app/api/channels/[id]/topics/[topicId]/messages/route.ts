import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'
import { broadcastToOrg } from '@/lib/sse'
import { embedText, pgVector } from '@/lib/embed'

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

  // Detect @mentions and insert notifications
  const mentionMatches = [...body.matchAll(/@(\w+)/g)].map(m => m[1].toLowerCase())
  if (mentionMatches.length > 0) {
    const mentioned = await db`
      SELECT DISTINCT ON (author_id) author_id
      FROM channel_messages
      WHERE org_id = ${session.orgId}
        AND lower(author_name) = ANY(${mentionMatches})
        AND author_id != ${session.userId}
        AND deleted_at IS NULL
      ORDER BY author_id, created_at DESC
    `
    for (const u of mentioned) {
      await db`
        INSERT INTO channel_notifications
          (org_id, user_id, channel_id, topic_id, message_id, type)
        VALUES
          (${session.orgId}, ${u.author_id}, ${id}, ${topicId}, ${message.id}, 'mention')
      `
    }
    if (mentioned.length > 0) {
      const mentionedTyped = mentioned as unknown as { author_id: string }[]
      broadcastToOrg(session.orgId, {
        type:      'mention:new',
        userIds:   mentionedTyped.map(u => u.author_id),
        channelId: id,
        topicId,
        messageId: message.id,
      })
    }
  }

  broadcastToOrg(session.orgId, {
    type:      'message:new',
    channelId: id,
    topicId,
    message,
  })

  // Async embed — does not block the response
  void embedText(body.trim()).then(async vec => {
    if (!vec) return
    await db`
      UPDATE channel_messages SET embedding = ${pgVector(vec)}::vector
      WHERE id = ${message.id}
    `
  }).catch(err => console.error('[embed] message update failed:', err))

  return NextResponse.json(message, { status: 201 })
}
