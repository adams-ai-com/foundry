import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ callId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { callId } = await params

  // Verify the call belongs to this org
  const [call] = await db`
    SELECT id FROM video_calls
    WHERE id = ${callId} AND org_id = ${session.orgId}
  `
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [summary] = await db`
    SELECT vs.id, vs.call_id, vs.summary, vs.action_items, vs.decisions,
           vs.generated_at, vs.posted_to_channel, vs.posted_message_id,
           vt.transcript_text, vt.processed_at as transcribed_at, vt.whisper_model
    FROM video_summaries vs
    LEFT JOIN video_transcripts vt ON vt.call_id = vs.call_id
    WHERE vs.call_id = ${callId}
  `

  if (!summary) return NextResponse.json({ summary: null })
  return NextResponse.json({ summary })
}
