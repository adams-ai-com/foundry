import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'
import { embedText, pgVector } from '@/lib/embed'
import { isGuardianConfigured } from '@/lib/guardian'

export const dynamic = 'force-dynamic'

const BATCH = 25 // messages per backfill call

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isGuardianConfigured()) {
    return NextResponse.json({ error: 'Guardian not configured' }, { status: 503 })
  }

  const { type = 'messages' } = await req.json() as { type?: 'messages' | 'transcripts' }

  if (type === 'transcripts') {
    const rows = await db`
      SELECT vt.id, vt.transcript_text
      FROM video_transcripts vt
      JOIN video_calls vc ON vc.id = vt.call_id
      WHERE vc.org_id = ${session.orgId}
        AND vt.embedding IS NULL
        AND vt.transcript_text IS NOT NULL
      LIMIT ${BATCH}
    ` as { id: string; transcript_text: string }[]

    let embedded = 0
    for (const row of rows) {
      const vec = await embedText(row.transcript_text)
      if (!vec) continue
      await db`
        UPDATE video_transcripts SET embedding = ${pgVector(vec)}::vector
        WHERE id = ${row.id}
      `
      embedded++
    }

    const [{ remaining }] = await db`
      SELECT COUNT(*) as remaining FROM video_transcripts vt
      JOIN video_calls vc ON vc.id = vt.call_id
      WHERE vc.org_id = ${session.orgId} AND vt.embedding IS NULL AND vt.transcript_text IS NOT NULL
    ` as { remaining: string }[]

    return NextResponse.json({ embedded, remaining: parseInt(remaining), type: 'transcripts' })
  }

  // Default: messages
  const rows = await db`
    SELECT id, body FROM channel_messages
    WHERE org_id = ${session.orgId}
      AND embedding IS NULL
      AND deleted_at IS NULL
      AND is_system IS NOT TRUE
    ORDER BY created_at DESC
    LIMIT ${BATCH}
  ` as { id: string; body: string }[]

  let embedded = 0
  for (const row of rows) {
    const vec = await embedText(row.body)
    if (!vec) break // Guardian unavailable — stop early
    await db`
      UPDATE channel_messages SET embedding = ${pgVector(vec)}::vector
      WHERE id = ${row.id}
    `
    embedded++
  }

  const [{ remaining }] = await db`
    SELECT COUNT(*) as remaining FROM channel_messages
    WHERE org_id = ${session.orgId} AND embedding IS NULL
      AND deleted_at IS NULL AND is_system IS NOT TRUE
  ` as { remaining: string }[]

  return NextResponse.json({ embedded, remaining: parseInt(remaining), type: 'messages' })
}
