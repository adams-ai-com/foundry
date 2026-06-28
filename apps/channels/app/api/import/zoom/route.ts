import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import db from '@/lib/db'
import { extractMetaFromFilename, type ZoomRecording } from '@/lib/zoom-importer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jobs = await db`
    SELECT id, status, total, processed, error_message, created_at
    FROM zoom_import_jobs WHERE org_id = ${session.orgId} ORDER BY created_at DESC LIMIT 10
  `
  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const files = form.getAll('files') as File[]
  if (!files.length) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })

  const jobId = randomUUID()
  // Group MP4+VTT pairs by filename stem
  const byKey = new Map<string, { rec: Partial<ZoomRecording> & { id: string }; vttBuf?: Buffer; mp4Buf?: Buffer }>()

  for (const file of files) {
    const name = file.name
    const isVtt = /\.(vtt)$/i.test(name)
    const isMp4 = /\.(mp4|m4a)$/i.test(name)
    if (!isVtt && !isMp4) continue

    const stem = name.replace(/\.transcript\.vtt$/i, '').replace(/\.(mp4|m4a|vtt)$/i, '')
    if (!byKey.has(stem)) {
      const meta = extractMetaFromFilename(name)
      byKey.set(stem, {
        rec: {
          id: randomUUID(),
          title: meta.title,
          recorded_at: meta.recorded_at,
          vtt_path: null,
          mp4_path: null,
          channel_id: null,
          topic_id: null,
          status: 'pending',
          call_id: null,
          error: null,
        },
      })
    }

    const entry = byKey.get(stem)!
    // Prefer MP4 filename metadata (usually more descriptive)
    if (isMp4 && (entry.rec.title === 'Zoom Recording' || !entry.rec.recorded_at)) {
      const meta = extractMetaFromFilename(name)
      if (meta.title !== 'Zoom Recording') entry.rec.title = meta.title
      if (meta.recorded_at) entry.rec.recorded_at = meta.recorded_at
    }

    const bytes = await file.arrayBuffer()
    if (isVtt) {
      entry.vttBuf = Buffer.from(bytes)
    } else if (bytes.byteLength <= 25 * 1024 * 1024) {
      // Only save MP4s under 25MB (Whisper cap); larger ones get metadata but no file
      entry.mp4Buf = Buffer.from(bytes)
    }
  }

  if (!byKey.size) return NextResponse.json({ error: 'No .vtt or .mp4 files found' }, { status: 400 })

  const recordings: ZoomRecording[] = []
  for (const { rec, vttBuf, mp4Buf } of byKey.values()) {
    if (vttBuf) {
      const p = join(tmpdir(), `zoom-vtt-${rec.id}.vtt`)
      writeFileSync(p, vttBuf)
      rec.vtt_path = p
    }
    if (mp4Buf) {
      const p = join(tmpdir(), `zoom-mp4-${rec.id}.mp4`)
      writeFileSync(p, mp4Buf)
      rec.mp4_path = p
    }
    recordings.push(rec as ZoomRecording)
  }

  await db`
    INSERT INTO zoom_import_jobs (id, org_id, created_by, status, recordings, total)
    VALUES (${jobId}, ${session.orgId}, ${session.userId}, 'pending',
            ${JSON.stringify(recordings)}, ${recordings.length})
  `

  return NextResponse.json({ jobId, recordings }, { status: 201 })
}
