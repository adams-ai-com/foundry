import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ count }] = await db`
    SELECT COUNT(*)::int as count
    FROM channel_notifications
    WHERE user_id = ${session.userId} AND org_id = ${session.orgId} AND read_at IS NULL
  ` as unknown as [{ count: number }]

  const recent = await db`
    SELECT
      n.id, n.type, n.read_at, n.created_at,
      n.channel_id, n.topic_id, n.message_id,
      c.name as channel_name,
      t.name as topic_name,
      m.author_name, m.body
    FROM channel_notifications n
    JOIN channels c ON c.id = n.channel_id
    LEFT JOIN channel_topics t ON t.id = n.topic_id
    LEFT JOIN channel_messages m ON m.id = n.message_id
    WHERE n.user_id = ${session.userId} AND n.org_id = ${session.orgId}
    ORDER BY n.created_at DESC
    LIMIT 20
  `

  return NextResponse.json({ count, notifications: recent })
}
