import { NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [waitingRows, staleRows, actionRows] = await Promise.all([

    // Topics where I sent the last message 3+ days ago with no reply
    db`
      SELECT ct.id AS topic_id, ct.name AS topic_name,
             c.id AS channel_id, c.name AS channel_name,
             ct.last_message_at, lm.body AS last_body
      FROM channel_topics ct
      JOIN channels c ON c.id = ct.channel_id
      CROSS JOIN LATERAL (
        SELECT cm.author_id, cm.body
        FROM channel_messages cm
        WHERE cm.topic_id = ct.id
          AND cm.deleted_at IS NULL
          AND cm.is_system IS NOT TRUE
        ORDER BY cm.created_at DESC LIMIT 1
      ) lm
      WHERE ct.org_id = ${session.orgId}
        AND ct.is_resolved = false
        AND ct.last_message_at < now() - interval '3 days'
        AND ct.message_count > 1
        AND lm.author_id = ${session.userId}
      ORDER BY ct.last_message_at ASC
      LIMIT 10
    ` as unknown as {
      topic_id: string; topic_name: string
      channel_id: string; channel_name: string
      last_message_at: string; last_body: string
    }[],

    // Unresolved topics I participated in with no activity for 7+ days
    db`
      SELECT ct.id AS topic_id, ct.name AS topic_name,
             c.id AS channel_id, c.name AS channel_name,
             ct.last_message_at, ct.message_count
      FROM channel_topics ct
      JOIN channels c ON c.id = ct.channel_id
      WHERE ct.org_id = ${session.orgId}
        AND ct.is_resolved = false
        AND ct.last_message_at < now() - interval '7 days'
        AND ct.message_count >= 3
        AND EXISTS (
          SELECT 1 FROM channel_messages cm
          WHERE cm.topic_id = ct.id
            AND cm.author_id = ${session.userId}
            AND cm.deleted_at IS NULL
        )
      ORDER BY ct.last_message_at ASC
      LIMIT 10
    ` as unknown as {
      topic_id: string; topic_name: string
      channel_id: string; channel_name: string
      last_message_at: string; message_count: number
    }[],

    // Open action items from video call summaries (last 60 days)
    db`
      SELECT vc.id AS call_id, vc.title AS call_title, vc.ended_at,
             vc.channel_id, vc.topic_id,
             c.name AS channel_name, ct.name AS topic_name,
             vs.action_items
      FROM video_summaries vs
      JOIN video_calls vc ON vc.id = vs.call_id
      LEFT JOIN channels c ON c.id = vc.channel_id
      LEFT JOIN channel_topics ct ON ct.id = vc.topic_id
      WHERE vc.org_id = ${session.orgId}
        AND vs.action_items != '[]'::jsonb
        AND vc.ended_at > now() - interval '60 days'
      ORDER BY vc.ended_at DESC
      LIMIT 10
    ` as unknown as {
      call_id: string; call_title: string; ended_at: string
      channel_id: string | null; topic_id: string | null
      channel_name: string | null; topic_name: string | null
      action_items: { text: string; assignee_guess: string | null }[]
    }[],
  ])

  // Deduplicate stale_topics — remove any already in waiting_on_others
  const waitingIds = new Set(waitingRows.map(r => r.topic_id))
  const staleFiltered = staleRows.filter(r => !waitingIds.has(r.topic_id))

  const total = waitingRows.length + staleFiltered.length + actionRows.length

  return NextResponse.json({
    waiting_on_others: waitingRows,
    stale_topics:      staleFiltered,
    action_items:      actionRows,
    total,
  })
}
