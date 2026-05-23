import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { AccessToken } from 'livekit-server-sdk'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ callId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey    = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL
  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json({ error: 'Video not configured on this server' }, { status: 503 })
  }

  const { callId } = await params

  const [call] = await db`
    SELECT id, livekit_room_name, status
    FROM video_calls
    WHERE id = ${callId} AND org_id = ${session.orgId} AND status != 'ended'
  `
  if (!call) return NextResponse.json({ error: 'Call not found or already ended' }, { status: 404 })

  await db`
    INSERT INTO video_participants (call_id, user_id, display_name)
    VALUES (${callId}, ${session.userId}, ${session.name ?? session.email})
    ON CONFLICT (call_id, user_id) DO UPDATE
      SET joined_at = now(), left_at = NULL, duration_seconds = NULL
  `

  if (call.status === 'waiting') {
    await db`UPDATE video_calls SET status = 'active', started_at = now() WHERE id = ${callId}`
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: session.userId,
    name:     session.name ?? session.email,
  })
  at.addGrant({
    roomJoin:     true,
    room:         call.livekit_room_name as string,
    canPublish:   true,
    canSubscribe: true,
  })
  const token = await at.toJwt()

  return NextResponse.json({ token, serverUrl })
}
