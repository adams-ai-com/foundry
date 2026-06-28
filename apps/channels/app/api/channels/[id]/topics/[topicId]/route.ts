import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'
import { broadcastToOrg } from '@/lib/sse'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; topicId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, topicId } = await params
  const { is_resolved } = await req.json() as { is_resolved: boolean }

  const [topic] = await db`
    UPDATE channel_topics
    SET is_resolved = ${is_resolved}
    WHERE id = ${topicId} AND channel_id = ${id} AND org_id = ${session.orgId}
    RETURNING id, name, is_resolved, last_message_at, message_count
  `
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  broadcastToOrg(session.orgId, { type: 'topic:resolve', channelId: id, topic })
  return NextResponse.json(topic)
}
