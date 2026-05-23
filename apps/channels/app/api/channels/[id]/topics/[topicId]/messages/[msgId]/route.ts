import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'
import { broadcastToOrg } from '@/lib/sse'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; topicId: string; msgId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, topicId, msgId } = await params
  const { body } = await req.json() as { body: string }
  if (!body?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const [message] = await db`
    UPDATE channel_messages
    SET body = ${body.trim()}, edited_at = now()
    WHERE id = ${msgId} AND topic_id = ${topicId} AND channel_id = ${id}
      AND org_id = ${session.orgId} AND author_id = ${session.userId}
      AND deleted_at IS NULL
    RETURNING id, author_id, author_name, author_email, body, reactions, edited_at, created_at
  `
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  broadcastToOrg(session.orgId, { type: 'message:edit', channelId: id, topicId, message })
  return NextResponse.json(message)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, topicId, msgId } = await params

  const [msg] = await db`
    UPDATE channel_messages SET deleted_at = now()
    WHERE id = ${msgId} AND topic_id = ${topicId} AND channel_id = ${id}
      AND org_id = ${session.orgId} AND author_id = ${session.userId}
      AND deleted_at IS NULL
    RETURNING id
  `
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  broadcastToOrg(session.orgId, { type: 'message:delete', channelId: id, topicId, messageId: msgId })
  return NextResponse.json({ ok: true })
}
