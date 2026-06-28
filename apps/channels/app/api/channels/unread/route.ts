import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db`
    SELECT
      t.id as topic_id,
      COUNT(m.id)::int as unread_count
    FROM channel_topics t
    JOIN channels c ON c.id = t.channel_id
    LEFT JOIN channel_read_state rs ON rs.topic_id = t.id AND rs.user_id = ${session.userId}
    LEFT JOIN channel_messages m ON m.topic_id = t.id
      AND m.deleted_at IS NULL
      AND (rs.last_read_at IS NULL OR m.created_at > rs.last_read_at)
    WHERE c.org_id = ${session.orgId} AND c.is_archived = false
    GROUP BY t.id
    HAVING COUNT(m.id) > 0
  `

  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.topic_id as string] = row.unread_count as number
  }
  return NextResponse.json(result)
}
