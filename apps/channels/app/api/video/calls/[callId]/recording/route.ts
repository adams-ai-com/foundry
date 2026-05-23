import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { EgressClient } from 'livekit-server-sdk'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ callId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { callId } = await params
  const { action } = await req.json() as { action: 'start' | 'stop' }

  const [call] = await db`
    SELECT id, org_id, livekit_room_name, recording_enabled, egress_id, created_by
    FROM video_calls
    WHERE id = ${callId} AND org_id = ${session.orgId} AND status = 'active'
  `
  if (!call) return NextResponse.json({ error: 'Call not found or not active' }, { status: 404 })

  // Only the call creator can toggle recording
  if (call.created_by !== session.userId) {
    return NextResponse.json({ error: 'Only the call creator can toggle recording' }, { status: 403 })
  }

  const apiKey    = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const wsUrl     = process.env.NEXT_PUBLIC_LIVEKIT_URL
  const httpUrl   = wsUrl?.replace('wss://', 'https://').replace('ws://', 'http://')

  if (action === 'start') {
    let egressId: string | null = null

    if (apiKey && apiSecret && httpUrl) {
      try {
        const egress = new EgressClient(httpUrl, apiKey, apiSecret)
        const info = await egress.startRoomCompositeEgress(call.livekit_room_name as string, {
          file: { filepath: `recordings/${callId}.mp4` },
        } as Parameters<typeof egress.startRoomCompositeEgress>[1])
        egressId = info.egressId ?? null
      } catch (err) {
        console.error('[recording] Egress start failed:', err)
        // Continue — record intent in DB even if Egress not running
      }
    }

    await db`
      UPDATE video_calls
      SET recording_enabled = true, egress_id = ${egressId}
      WHERE id = ${callId}
    `
    return NextResponse.json({ recording_enabled: true })
  }

  if (action === 'stop') {
    if (apiKey && apiSecret && httpUrl && call.egress_id) {
      try {
        const egress = new EgressClient(httpUrl, apiKey, apiSecret)
        await egress.stopEgress(call.egress_id as string)
      } catch (err) {
        console.error('[recording] Egress stop failed:', err)
      }
    }

    await db`
      UPDATE video_calls SET recording_enabled = false WHERE id = ${callId}
    `
    return NextResponse.json({ recording_enabled: false })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
