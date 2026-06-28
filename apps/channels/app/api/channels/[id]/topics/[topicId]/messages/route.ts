import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'
import { broadcastToOrg } from '@/lib/sse'
import { embedText, pgVector } from '@/lib/embed'
import { sendPushToUser } from '@/lib/push'

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

  const [topicRow] = await db`
    SELECT t.id, t.name AS topic_name, c.name AS channel_name, c.type AS channel_type
    FROM channel_topics t
    JOIN channels c ON c.id = t.channel_id
    WHERE t.id = ${topicId} AND t.channel_id = ${id} AND c.org_id = ${session.orgId}
  ` as { id: string; topic_name: string; channel_name: string; channel_type: string }[]
  if (!topicRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

  // Detect @mentions and insert notifications + push
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
    ` as { author_id: string }[]

    for (const u of mentioned) {
      await db`
        INSERT INTO channel_notifications
          (org_id, user_id, channel_id, topic_id, message_id, type)
        VALUES
          (${session.orgId}, ${u.author_id}, ${id}, ${topicId}, ${message.id}, 'mention')
      `
      // Fire push — non-blocking
      void sendPushToUser(u.author_id, {
        title: `${authorName} mentioned you in #${topicRow.channel_name}`,
        body: `${topicRow.topic_name}: ${body.trim().slice(0, 120)}`,
        tag: `mention-${u.author_id}`,
      }).catch(() => {})
    }

    if (mentioned.length > 0) {
      broadcastToOrg(session.orgId, {
        type:      'mention:new',
        userIds:   mentioned.map(u => u.author_id),
        channelId: id,
        topicId,
        messageId: message.id,
      })
    }
  }

  // DM channel: push the other participant
  if (topicRow.channel_type === 'dm') {
    const others = await db`
      SELECT DISTINCT author_id FROM channel_messages
      WHERE channel_id = ${id} AND org_id = ${session.orgId}
        AND author_id != ${session.userId}
      LIMIT 5
    ` as { author_id: string }[]
    for (const u of others) {
      void sendPushToUser(u.author_id, {
        title: `New message from ${authorName}`,
        body: body.trim().slice(0, 140),
        tag: `dm-${id}`,
      }).catch(() => {})
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
