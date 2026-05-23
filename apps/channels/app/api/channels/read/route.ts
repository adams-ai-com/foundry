import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topicId } = await req.json() as { topicId: string }
  if (!topicId) return NextResponse.json({ error: 'topicId required' }, { status: 400 })

  await db`
    INSERT INTO channel_read_state (user_id, topic_id, last_read_at)
    VALUES (${session.userId}, ${topicId}, now())
    ON CONFLICT (user_id, topic_id) DO UPDATE SET last_read_at = now()
  `

  return NextResponse.json({ ok: true })
}
