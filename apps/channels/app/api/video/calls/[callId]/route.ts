import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'
import { broadcastToOrg } from '@/lib/sse'
import { runPostCallPipeline } from '@/lib/video-pipeline'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ callId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { callId } = await params

  const [call] = await db`
    SELECT vc.id, vc.title, vc.status, vc.channel_id, vc.topic_id,
           vc.created_by_name, vc.created_at, vc.started_at, vc.ended_at,
           vc.livekit_room_name,
           COALESCE(
             json_agg(
               json_build_object('userId', vp.user_id, 'displayName', vp.display_name, 'joinedAt', vp.joined_at)
             ) FILTER (WHERE vp.id IS NOT NULL AND vp.left_at IS NULL),
             '[]'
           ) as participants
    FROM video_calls vc
    LEFT JOIN video_participants vp ON vp.call_id = vc.id
    WHERE vc.id = ${callId} AND vc.org_id = ${session.orgId}
    GROUP BY vc.id
  `
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(call)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { callId } = await params
  const { action } = await req.json() as { action: 'leave' | 'end' }

  const [call] = await db`
    SELECT id, org_id, channel_id, topic_id FROM video_calls
    WHERE id = ${callId} AND org_id = ${session.orgId}
  `
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db`
    UPDATE video_participants
    SET left_at = now(),
        duration_seconds = EXTRACT(EPOCH FROM (now() - joined_at))::integer
    WHERE call_id = ${callId} AND user_id = ${session.userId} AND left_at IS NULL
  `

  const [{ count }] = await db`
    SELECT COUNT(*) as count FROM video_participants
    WHERE call_id = ${callId} AND left_at IS NULL
  ` as unknown as [{ count: string }]

  if (parseInt(count) === 0 || action === 'end') {
    await db`
      UPDATE video_calls SET status = 'ended', ended_at = now() WHERE id = ${callId}
    `
    broadcastToOrg(session.orgId, {
      type: 'call:ended',
      callId,
      channelId: call.channel_id,
      topicId: call.topic_id,
    })
    // Fire post-call pipeline asynchronously — do not block the response
    void runPostCallPipeline(callId, session.orgId)
  }

  return NextResponse.json({ ok: true })
}
