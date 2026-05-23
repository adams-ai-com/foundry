import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type CallRow = {
  id: string; title: string; channel_id: string | null; topic_id: string | null
  ended_at: string; channel_name: string | null; topic_name: string | null
  ai_summary: string | null; duration_minutes: string
}

type MsgRow = {
  day: string; channel_id: string; topic_id: string
  channel_name: string; topic_name: string
  message_count: string; latest_at: string; participants: string[]
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') ?? '30'), 90)

  const callRows = await db`
    SELECT vc.id, vc.title, vc.channel_id, vc.topic_id,
           vc.ended_at,
           c.name AS channel_name, ct.name AS topic_name,
           vs.summary AS ai_summary,
           EXTRACT(EPOCH FROM (vc.ended_at - vc.started_at)) / 60 AS duration_minutes
    FROM video_calls vc
    LEFT JOIN channels c        ON c.id  = vc.channel_id
    LEFT JOIN channel_topics ct ON ct.id = vc.topic_id
    LEFT JOIN video_summaries vs ON vs.call_id = vc.id
    WHERE vc.org_id = ${session.orgId}
      AND vc.status = 'ended'
      AND vc.ended_at >= now() - interval '1 day' * ${days}
    ORDER BY vc.ended_at DESC
    LIMIT 100
  ` as unknown as CallRow[]

  const msgRows = await db`
    SELECT
      date_trunc('day', cm.created_at)::date AS day,
      cm.channel_id,
      cm.topic_id,
      c.name  AS channel_name,
      ct.name AS topic_name,
      COUNT(*) AS message_count,
      MAX(cm.created_at) AS latest_at,
      array_agg(DISTINCT cm.author_name ORDER BY cm.author_name)
        FILTER (WHERE cm.author_name IS NOT NULL) AS participants
    FROM channel_messages cm
    JOIN channels c        ON c.id  = cm.channel_id
    JOIN channel_topics ct ON ct.id = cm.topic_id
    WHERE cm.org_id = ${session.orgId}
      AND cm.deleted_at IS NULL
      AND cm.is_system IS NOT TRUE
      AND cm.created_at >= now() - interval '1 day' * ${days}
    GROUP BY date_trunc('day', cm.created_at)::date, cm.channel_id, cm.topic_id, c.name, ct.name
    ORDER BY day DESC, latest_at DESC
    LIMIT 200
  ` as unknown as MsgRow[]

  // Group by day
  const dayMap = new Map<string, { calls: CallRow[]; messages: MsgRow[] }>()

  for (const call of callRows) {
    const day = call.ended_at.slice(0, 10)
    if (!dayMap.has(day)) dayMap.set(day, { calls: [], messages: [] })
    dayMap.get(day)!.calls.push(call)
  }
  for (const msg of msgRows) {
    const day = msg.day.slice(0, 10)
    if (!dayMap.has(day)) dayMap.set(day, { calls: [], messages: [] })
    dayMap.get(day)!.messages.push(msg)
  }

  const sorted = [...dayMap.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  const timeline = sorted.map(([date, { calls, messages }]) => ({
    date,
    items: [
      ...calls.map(c => ({
        type:             'call' as const,
        id:               c.id,
        title:            c.title,
        channel_id:       c.channel_id,
        topic_id:         c.topic_id,
        channel_name:     c.channel_name,
        topic_name:       c.topic_name,
        duration_minutes: Math.round(Number(c.duration_minutes) || 0),
        ai_summary:       c.ai_summary ?? null,
        at:               c.ended_at,
      })),
      ...messages.map(m => ({
        type:          'messages' as const,
        channel_id:    m.channel_id,
        topic_id:      m.topic_id,
        channel_name:  m.channel_name,
        topic_name:    m.topic_name,
        message_count: Number(m.message_count),
        participants:  (m.participants ?? []).slice(0, 4),
        at:            m.latest_at,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at)),
  }))

  return NextResponse.json({ timeline, days })
}
