import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import db from '@/lib/db'
import { runPostCallPipeline } from '@/lib/video-pipeline'

// ─── VTT parsing ─────────────────────────────────────────────────────────

type VttSegment = { start: number; end: number; speaker: string | null; text: string }

function parseVttTime(ts: string): number {
  const parts = ts.trim().split(':')
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
  }
  return parseInt(parts[0]) * 60 + parseFloat(parts[1])
}

export function parseVtt(content: string): { transcript: string; segments: VttSegment[] } {
  const segments: VttSegment[] = []
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    // Skip WEBVTT header, NOTE blocks, and sequence numbers
    if (line === 'WEBVTT' || line.startsWith('NOTE') || line === '' || /^\d+$/.test(line)) {
      i++; continue
    }

    // Timestamp line
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map(s => s.split(' ')[0].trim())
      const start = parseVttTime(startStr)
      const end = parseVttTime(endStr)

      // Collect cue text lines
      const textLines: string[] = []
      i++
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim())
        i++
      }

      let rawText = textLines.join(' ')
      // Extract speaker from <v Speaker>text</v> format
      let speaker: string | null = null
      const vTag = rawText.match(/^<v ([^>]+)>(.*)<\/v>$/)
      if (vTag) { speaker = vTag[1]; rawText = vTag[2] }
      // Strip any remaining HTML tags
      rawText = rawText.replace(/<[^>]+>/g, '').trim()

      if (rawText) segments.push({ start, end, speaker, text: rawText })
    } else {
      i++
    }
  }

  // Build full transcript; include speaker labels if present
  const transcript = segments
    .map(s => s.speaker ? `${s.speaker}: ${s.text}` : s.text)
    .join(' ')

  return { transcript, segments }
}

// ─── Filename metadata extraction ────────────────────────────────────────

export function extractMetaFromFilename(filename: string): { title: string; recorded_at: string | null } {
  // Pattern: GMT20240105-143000_Title.mp4 or GMT20240105-143000_Title.transcript.vtt
  const gmtMatch = filename.match(/GMT(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/)
  if (gmtMatch) {
    const [, y, mo, d, h, mi, s] = gmtMatch
    const recorded_at = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`
    // Title = everything after the timestamp prefix, minus extension
    const titlePart = filename
      .replace(/GMT\d{8}-\d{6}_?/, '')
      .replace(/\.(mp4|m4a|vtt|transcript\.vtt)$/i, '')
      .replace(/_/g, ' ').trim()
    return { title: titlePart || 'Zoom Recording', recorded_at }
  }

  // Pattern: Meeting Name 2024-01-05 at 14.00.00.mp4
  const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (dateMatch) {
    const recorded_at = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T00:00:00Z`
    const title = filename
      .replace(/\d{4}-\d{2}-\d{2}.*/, '')
      .replace(/\.(mp4|m4a|vtt)$/i, '')
      .replace(/[_-]+$/, '').trim()
    return { title: title || 'Zoom Recording', recorded_at }
  }

  const title = filename.replace(/\.(mp4|m4a|vtt|transcript\.vtt)$/i, '').replace(/[_-]/g, ' ').trim()
  return { title: title || 'Zoom Recording', recorded_at: null }
}

// ─── Recording type ───────────────────────────────────────────────────────

export type ZoomRecording = {
  id: string
  title: string
  recorded_at: string | null
  vtt_path: string | null
  mp4_path: string | null
  channel_id: string | null
  topic_id: string | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  call_id: string | null
  error: string | null
}

// ─── Import runner ────────────────────────────────────────────────────────

export async function runZoomImport(jobId: string, orgId: string, createdBy: string): Promise<void> {
  const jobs = await db`SELECT * FROM zoom_import_jobs WHERE id = ${jobId} AND org_id = ${orgId}` as unknown as Record<string, unknown>[]
  if (!jobs.length) throw new Error('Job not found')
  const job = jobs[0] as { recordings: ZoomRecording[] }

  let processed = 0

  for (const rec of job.recordings) {
    if (rec.status !== 'pending') { processed++; continue }

    // Update status to processing
    rec.status = 'processing'
    await db`
      UPDATE zoom_import_jobs SET recordings = ${JSON.stringify(job.recordings)} WHERE id = ${jobId}
    `

    try {
      // Create video_calls record
      const roomName = `zoom-import-${rec.id}`
      const recordedAt = rec.recorded_at ? new Date(rec.recorded_at).toISOString() : new Date().toISOString()
      const [call] = await db`
        INSERT INTO video_calls
          (org_id, livekit_room_name, title, created_by, created_by_name, source,
           channel_id, topic_id, recording_path, recording_enabled,
           started_at, ended_at, status)
        VALUES
          (${orgId}, ${roomName}, ${rec.title}, ${createdBy}, 'Zoom Import', 'zoom_import',
           ${rec.channel_id ?? null}, ${rec.topic_id ?? null},
           ${rec.mp4_path ?? null}, ${rec.mp4_path !== null},
           ${recordedAt}, ${recordedAt}, 'ended')
        ON CONFLICT (livekit_room_name) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
      ` as { id: string }[]

      rec.call_id = call.id

      // Save VTT transcript if provided
      if (rec.vtt_path && existsSync(rec.vtt_path)) {
        const { readFileSync } = await import('node:fs')
        const vttContent = readFileSync(rec.vtt_path, 'utf8')
        const { transcript, segments } = parseVtt(vttContent)

        if (transcript.trim()) {
          await db`
            INSERT INTO video_transcripts (call_id, transcript_text, processed_at, whisper_model)
            VALUES (${call.id}, ${transcript}, now(), 'vtt-import')
            ON CONFLICT (call_id) DO UPDATE
              SET transcript_text = EXCLUDED.transcript_text, processed_at = EXCLUDED.processed_at,
                  whisper_model = EXCLUDED.whisper_model
          `

          // Save segments for time-linked search
          const [transcriptRow] = await db`
            SELECT id FROM video_transcripts WHERE call_id = ${call.id}
          ` as { id: string }[]

          if (transcriptRow && segments.length > 0) {
            const segValues = segments.map(s =>
              `('${randomUUID()}', '${transcriptRow.id}', ${s.speaker ? `'${s.speaker.replace(/'/g, "''")}'` : 'NULL'},
               ${s.start}, ${s.end}, '${s.text.replace(/'/g, "''")}')`
            ).join(',')
            await db.unsafe(`
              INSERT INTO video_transcript_segments
                (id, transcript_id, speaker_label, start_seconds, end_seconds, text)
              VALUES ${segValues}
              ON CONFLICT DO NOTHING
            `)
          }
        }
      }

      // Run the post-call pipeline (uses existing VTT transcript; skips Whisper if transcript exists)
      await runPostCallPipeline(call.id, orgId)

      rec.status = 'done'
    } catch (err) {
      console.error(`[zoom-import] recording ${rec.id} failed:`, err)
      rec.status = 'failed'
      rec.error = String(err)
    }

    processed++
    await db`
      UPDATE zoom_import_jobs SET recordings = ${JSON.stringify(job.recordings)}, processed = ${processed}
      WHERE id = ${jobId}
    `
  }

  const allDone = job.recordings.every(r => r.status === 'done' || r.status === 'failed')
  const anyFailed = job.recordings.some(r => r.status === 'failed')

  await db`
    UPDATE zoom_import_jobs
    SET status = ${anyFailed ? 'partial' : 'complete'}, processed = ${processed}
    WHERE id = ${jobId}
  `
}
