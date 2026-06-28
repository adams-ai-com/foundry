import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'
import { broadcastToOrg } from '@/lib/sse'

export const dynamic = 'force-dynamic'

type Reaction = { emoji: string; user_ids: string[] }
type Params = { params: Promise<{ id: string; topicId: string; msgId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, topicId, msgId } = await params
  const { emoji } = await req.json() as { emoji: string }
  if (!emoji) return NextResponse.json({ error: 'Emoji required' }, { status: 400 })

  const [existing] = await db`
    SELECT reactions FROM channel_messages
    WHERE id = ${msgId} AND org_id = ${session.orgId} AND deleted_at IS NULL
  `
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const reactions: Reaction[] = (existing.reactions as Reaction[]) ?? []
  const idx = reactions.findIndex(r => r.emoji === emoji)

  if (idx === -1) {
    reactions.push({ emoji, user_ids: [session.userId] })
  } else {
    const has = reactions[idx].user_ids.includes(session.userId)
    if (has) {
      reactions[idx].user_ids = reactions[idx].user_ids.filter(u => u !== session.userId)
      if (reactions[idx].user_ids.length === 0) reactions.splice(idx, 1)
    } else {
      reactions[idx].user_ids = [...reactions[idx].user_ids, session.userId]
    }
  }

  const [message] = await db`
    UPDATE channel_messages SET reactions = ${JSON.stringify(reactions)}::jsonb
    WHERE id = ${msgId} AND org_id = ${session.orgId}
    RETURNING id, author_id, author_name, author_email, body, reactions, edited_at, created_at
  `

  broadcastToOrg(session.orgId, { type: 'message:reaction', channelId: id, topicId, message })
  return NextResponse.json(message)
}
