import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'
import type { ZoomRecording } from '@/lib/zoom-importer'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ jobId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params

  const { mappings } = await req.json() as {
    mappings: Array<{ id: string; channel_id: string | null; topic_id: string | null }>
  }

  const [job] = await db`
    SELECT recordings FROM zoom_import_jobs
    WHERE id = ${jobId} AND org_id = ${session.orgId} AND status = 'pending'
  ` as { recordings: ZoomRecording[] }[]

  if (!job) return NextResponse.json({ error: 'Not found or already running' }, { status: 404 })

  const byId = new Map(mappings.map(m => [m.id, m]))
  const updated = job.recordings.map(r => {
    const m = byId.get(r.id)
    if (!m) return r
    return { ...r, channel_id: m.channel_id, topic_id: m.topic_id }
  })

  await db`
    UPDATE zoom_import_jobs SET recordings = ${JSON.stringify(updated)} WHERE id = ${jobId}
  `

  return NextResponse.json({ ok: true })
}
