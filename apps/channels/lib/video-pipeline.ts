import { readFileSync, existsSync } from 'node:fs'
import db from '@/lib/db'
import { broadcastToOrg } from '@/lib/sse'
import { callGuardianTool, isGuardianConfigured } from '@/lib/guardian'
import { embedText, pgVector } from '@/lib/embed'

type ActionItem = { text: string; assignee_guess: string | null }
type Decision   = { text: string }
type AISummary  = { summary: string[]; action_items: ActionItem[]; decisions: Decision[] }

// ─── Whisper transcription ────────────────────────────────────────────────

async function transcribeRecording(
  callId: string,
  recordingPath: string,
): Promise<string | null> {
  // Only attempt local absolute paths; Egress remote paths are not accessible
  if (!recordingPath.startsWith('/')) {
    console.log(`[pipeline] ${callId}: recording path is not a local absolute path, skipping Whisper`)
    return null
  }
  if (!existsSync(recordingPath)) {
    console.log(`[pipeline] ${callId}: recording file not found at ${recordingPath}, skipping Whisper`)
    return null
  }

  const MAX_BYTES = 25 * 1024 * 1024
  let audioBytes: Buffer
  try {
    audioBytes = readFileSync(recordingPath)
  } catch (err) {
    console.error(`[pipeline] ${callId}: failed to read recording:`, err)
    return null
  }

  if (audioBytes.length > MAX_BYTES) {
    console.log(`[pipeline] ${callId}: recording ${audioBytes.length} bytes exceeds 25MB Whisper cap, skipping`)
    return null
  }

  try {
    const result = await callGuardianTool('whisper-transcribe', {
      audio_b64: audioBytes.toString('base64'),
      mime_type: 'audio/mp4',
      language: 'en',
    }) as { text: string }

    // Save to video_transcripts
    const [transcript] = await db`
      INSERT INTO video_transcripts (call_id, transcript_text, processed_at, whisper_model)
      VALUES (${callId}, ${result.text}, now(), 'whisper-1')
      ON CONFLICT (call_id) DO UPDATE
        SET transcript_text = EXCLUDED.transcript_text, processed_at = EXCLUDED.processed_at
      RETURNING id
    ` as { id: string }[]
    console.log(`[pipeline] ${callId}: transcript saved (${result.text.length} chars)`)

    // Async embed the transcript text
    void embedText(result.text).then(async vec => {
      if (!vec) return
      await db`
        UPDATE video_transcripts SET embedding = ${pgVector(vec)}::vector
        WHERE id = ${transcript.id}
      `
    }).catch(err => console.error(`[pipeline] ${callId}: transcript embed failed:`, err))

    return result.text
  } catch (err) {
    console.error(`[pipeline] ${callId}: Whisper transcription failed:`, err)
    return null
  }
}

// ─── AI summary generation ────────────────────────────────────────────────

const SUMMARY_SYSTEM = `You are an AI assistant that generates concise meeting summaries from video call content. Be specific and factual. Output only valid JSON with no markdown fences or extra text.`

async function generateSummary(params: {
  title: string
  durationMinutes: number
  participants: string[]
  transcript: string | null
  topicMessages: string[]
}): Promise<AISummary> {
  const { title, durationMinutes, participants, transcript, topicMessages } = params

  const contentSection = transcript
    ? `Transcript:\n${transcript.slice(0, 8000)}`
    : topicMessages.length > 0
      ? `Chat messages from the call:\n${topicMessages.slice(0, 60).join('\n')}`
      : 'No content available.'

  const prompt = `Analyze this video call and generate a summary.

Call: ${title}
Duration: ${durationMinutes} minutes
Participants: ${participants.join(', ') || 'unknown'}

${contentSection}

Output ONLY valid JSON (no markdown, no extra text):
{
  "summary": ["bullet 1", "bullet 2", "bullet 3"],
  "action_items": [{"text": "what needs to be done", "assignee_guess": "name or null"}],
  "decisions": [{"text": "decision that was made"}]
}

Rules:
- 2–6 summary bullets, specific and past-tense
- Include action items only if clearly stated or strongly implied
- Include decisions only if explicitly made
- Empty arrays are acceptable if nothing applies`

  const result = await callGuardianTool('claude-api-call', {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  }) as { content: Array<{ type: string; text?: string }> }

  const block = result.content[0]
  if (!block || block.type !== 'text' || !block.text) {
    throw new Error('Unexpected response from Guardian claude-api-call')
  }

  const jsonMatch = block.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI response did not contain valid JSON')
  return JSON.parse(jsonMatch[0]) as AISummary
}

// ─── Format summary as channel message ───────────────────────────────────

function formatSummaryMessage(title: string, ai: AISummary): string {
  const parts: string[] = [`📋 Call summary: ${title}`]

  if (ai.summary.length > 0) {
    parts.push('')
    ai.summary.forEach(b => parts.push(`• ${b}`))
  }

  if (ai.action_items.length > 0) {
    parts.push('')
    parts.push('Action items:')
    ai.action_items.forEach(item => {
      const who = item.assignee_guess ? `${item.assignee_guess}: ` : ''
      parts.push(`☐ ${who}${item.text}`)
    })
  }

  if (ai.decisions.length > 0) {
    parts.push('')
    parts.push('Decisions:')
    ai.decisions.forEach(d => parts.push(`• ${d.text}`))
  }

  return parts.join('\n')
}

// ─── Main pipeline entry point ────────────────────────────────────────────

export async function runPostCallPipeline(callId: string, orgId: string): Promise<void> {
  console.log(`[pipeline] ${callId}: starting post-call pipeline`)

  if (!isGuardianConfigured()) {
    console.log(`[pipeline] ${callId}: GUARDIAN_SHARED_SECRET not set — skipping AI summary`)
    return
  }

  let call: {
    id: string; title: string; channel_id: string | null; topic_id: string | null
    started_at: string | null; ended_at: string | null; recording_path: string | null
  } | undefined

  try {
    ;[call] = await db`
      SELECT id, title, channel_id, topic_id, started_at, ended_at, recording_path
      FROM video_calls
      WHERE id = ${callId} AND org_id = ${orgId}
    ` as typeof call[]
  } catch (err) {
    console.error(`[pipeline] ${callId}: failed to fetch call:`, err)
    return
  }

  if (!call) {
    console.error(`[pipeline] ${callId}: call not found`)
    return
  }

  // Duration in minutes
  const durationMs = call.started_at && call.ended_at
    ? new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()
    : 0
  const durationMinutes = Math.round(durationMs / 60000)

  // Participants
  let participants: string[] = []
  try {
    const rows = await db`
      SELECT display_name FROM video_participants
      WHERE call_id = ${callId}
      GROUP BY display_name
    ` as { display_name: string }[]
    participants = rows.map(r => r.display_name).filter(Boolean)
  } catch {}

  // Topic messages during call window (for context / fallback)
  let topicMessages: string[] = []
  if (call.channel_id && call.topic_id && call.started_at) {
    try {
      const rows = await db`
        SELECT author_name, body FROM channel_messages
        WHERE channel_id = ${call.channel_id}
          AND topic_id = ${call.topic_id}
          AND created_at >= ${call.started_at}
          AND is_guest IS DISTINCT FROM true
        ORDER BY created_at ASC
        LIMIT 80
      ` as { author_name: string; body: string }[]
      topicMessages = rows.map(r => `${r.author_name}: ${r.body}`)
    } catch {}
  }

  // Use pre-saved transcript if available (e.g. from VTT/Zoom import), otherwise try Whisper
  let transcript: string | null = null
  try {
    const [existing] = await db`
      SELECT transcript_text FROM video_transcripts WHERE call_id = ${callId}
    ` as { transcript_text: string }[]
    if (existing?.transcript_text) transcript = existing.transcript_text
  } catch {}

  if (!transcript && call.recording_path) {
    transcript = await transcribeRecording(callId, call.recording_path)
  }

  // Skip AI summary if no content at all
  if (!transcript && topicMessages.length === 0) {
    console.log(`[pipeline] ${callId}: no content for summary, skipping`)
    return
  }

  // Generate AI summary
  let ai: AISummary
  try {
    ai = await generateSummary({
      title: call.title,
      durationMinutes,
      participants,
      transcript,
      topicMessages,
    })
  } catch (err) {
    console.error(`[pipeline] ${callId}: AI summary failed:`, err)
    return
  }

  // Save summary
  let summaryId: string
  try {
    const [row] = await db`
      INSERT INTO video_summaries (call_id, summary, action_items, decisions)
      VALUES (
        ${callId},
        ${ai.summary.join('\n')},
        ${JSON.stringify(ai.action_items)},
        ${JSON.stringify(ai.decisions)}
      )
      ON CONFLICT (call_id) DO UPDATE
        SET summary = EXCLUDED.summary,
            action_items = EXCLUDED.action_items,
            decisions = EXCLUDED.decisions,
            generated_at = now()
      RETURNING id
    ` as { id: string }[]
    summaryId = row.id
  } catch (err) {
    console.error(`[pipeline] ${callId}: failed to save summary:`, err)
    return
  }

  // Post summary message to topic if linked
  if (call.channel_id && call.topic_id) {
    const body = formatSummaryMessage(call.title, ai)
    try {
      const [msg] = await db`
        INSERT INTO channel_messages
          (channel_id, topic_id, org_id, author_id, author_name, author_email, body, is_system)
        VALUES (
          ${call.channel_id},
          ${call.topic_id},
          ${orgId},
          ${callId},
          'OpenWork Loft',
          'system@foundry.internal',
          ${body},
          true
        )
        RETURNING id, author_id, author_name, author_email, body, reactions, edited_at, created_at
      ` as { id: string; author_id: string; author_name: string; author_email: string; body: string; reactions: unknown; edited_at: string | null; created_at: string }[]

      await db`
        UPDATE channel_topics
        SET last_message_at = now(), message_count = message_count + 1
        WHERE id = ${call.topic_id}
      `

      await db`
        UPDATE video_summaries
        SET posted_to_channel = true, posted_message_id = ${msg.id}
        WHERE id = ${summaryId}
      `

      broadcastToOrg(orgId, {
        type: 'message:new',
        channelId: call.channel_id,
        topicId: call.topic_id,
        message: msg,
      })

      console.log(`[pipeline] ${callId}: summary posted to topic (msg ${msg.id})`)
    } catch (err) {
      console.error(`[pipeline] ${callId}: failed to post summary message:`, err)
    }
  }

  // Broadcast summary-ready event so clients can react (e.g., show a "View summary" button)
  broadcastToOrg(orgId, {
    type: 'call:summary',
    callId,
    channelId: call.channel_id,
    topicId: call.topic_id,
  })

  console.log(`[pipeline] ${callId}: post-call pipeline complete`)
}
