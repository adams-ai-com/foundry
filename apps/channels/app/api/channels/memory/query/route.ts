import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'
import { embedText, pgVector } from '@/lib/embed'
import { callGuardianTool, isGuardianConfigured } from '@/lib/guardian'

export const dynamic = 'force-dynamic'

const TOP_K   = 8
const EXCERPT = 500

type Source = {
  index:        number
  source_type:  'message' | 'transcript'
  source_id:    string
  channel_id:   string | null
  topic_id:     string | null
  channel_name: string | null
  topic_name:   string | null
  author_name:  string | null
  call_title:   string | null
  call_id:      string | null
  date:         string
  excerpt:      string
  score:        number
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function trunc(text: string, len = EXCERPT): string {
  return text.length > len ? text.slice(0, len) + '…' : text
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { query } = await req.json() as { query: string }
  if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

  if (!isGuardianConfigured()) {
    return NextResponse.json({
      answer: null,
      sources: [],
      note: 'Memory search requires Guardian (GUARDIAN_SHARED_SECRET + WireGuard to foundry-srv).',
    })
  }

  // Embed the query
  const queryVec = await embedText(query)
  if (!queryVec) {
    return NextResponse.json({
      answer: null,
      sources: [],
      note: 'Embedding unavailable — check Guardian/llmbox-srv connection.',
    })
  }

  const vecLiteral = pgVector(queryVec)

  // Parallel vector searches
  const [msgRows, txRows] = await Promise.all([
    db`
      SELECT cm.id, cm.channel_id, cm.topic_id, cm.author_name, cm.body, cm.created_at,
             c.name AS channel_name, ct.name AS topic_name,
             1 - (cm.embedding <=> ${vecLiteral}::vector) AS score
      FROM channel_messages cm
      JOIN channels c  ON c.id  = cm.channel_id
      JOIN channel_topics ct ON ct.id = cm.topic_id
      WHERE cm.org_id = ${session.orgId}
        AND cm.embedding IS NOT NULL
        AND cm.deleted_at IS NULL
        AND cm.is_system IS NOT TRUE
      ORDER BY cm.embedding <=> ${vecLiteral}::vector
      LIMIT ${TOP_K}
    ` as unknown as { id: string; channel_id: string; topic_id: string; author_name: string; body: string;
            created_at: string; channel_name: string; topic_name: string; score: number }[],

    db`
      SELECT vt.id, vt.transcript_text, vt.processed_at,
             vc.id AS call_id, vc.title AS call_title, vc.channel_id, vc.topic_id,
             1 - (vt.embedding <=> ${vecLiteral}::vector) AS score
      FROM video_transcripts vt
      JOIN video_calls vc ON vc.id = vt.call_id
      WHERE vc.org_id = ${session.orgId}
        AND vt.embedding IS NOT NULL
      ORDER BY vt.embedding <=> ${vecLiteral}::vector
      LIMIT ${TOP_K}
    ` as unknown as { id: string; transcript_text: string; processed_at: string;
            call_id: string; call_title: string; channel_id: string | null;
            topic_id: string | null; score: number }[],
  ])

  // Only include sources above a minimum relevance threshold
  const MIN_SCORE = 0.3
  const allSources = [
    ...msgRows.filter(r => Number(r.score) >= MIN_SCORE).map((r, i): Source => ({
      index:        i + 1,
      source_type:  'message',
      source_id:    r.id,
      channel_id:   r.channel_id,
      topic_id:     r.topic_id,
      channel_name: r.channel_name,
      topic_name:   r.topic_name,
      author_name:  r.author_name,
      call_title:   null,
      call_id:      null,
      date:         fmtDate(r.created_at),
      excerpt:      trunc(r.body),
      score:        Number(r.score),
    })),
    ...txRows.filter(r => Number(r.score) >= MIN_SCORE).map((r, i): Source => ({
      index:        msgRows.length + i + 1,
      source_type:  'transcript',
      source_id:    r.id,
      channel_id:   r.channel_id,
      topic_id:     r.topic_id,
      channel_name: null,
      topic_name:   null,
      author_name:  null,
      call_title:   r.call_title,
      call_id:      r.call_id,
      date:         fmtDate(r.processed_at),
      excerpt:      trunc(r.transcript_text),
      score:        Number(r.score),
    })),
  ].sort((a, b) => b.score - a.score).map((s, i) => ({ ...s, index: i + 1 }))

  if (allSources.length === 0) {
    return NextResponse.json({
      answer: 'No relevant information found in your workspace communications for that query.',
      sources: [],
    })
  }

  // Build context block for Claude
  const contextBlock = allSources.map(s => {
    if (s.source_type === 'message') {
      return `[${s.index}] Message by ${s.author_name} in #${s.channel_name}/${s.topic_name} (${s.date}):\n"${s.excerpt}"`
    } else {
      return `[${s.index}] Video call transcript: "${s.call_title}" (${s.date}):\n"${s.excerpt}"`
    }
  }).join('\n\n')

  const prompt = `You are an AI assistant with access to a team's communication history. Answer the question below using ONLY the provided sources. Be specific and concise. Reference sources by number [1], [2], etc. If the sources don't contain enough information, say so directly.

Sources:
${contextBlock}

Question: ${query}`

  let answer: string
  try {
    const result = await callGuardianTool('claude-api-call', {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You are a helpful assistant that answers questions about a team\'s communications. Be concise and cite sources with [N] notation.',
      messages: [{ role: 'user', content: prompt }],
    }) as { content: Array<{ type: string; text?: string }> }

    const block = result.content[0]
    if (!block || block.type !== 'text' || !block.text) throw new Error('no text block')
    answer = block.text
  } catch (err) {
    console.error('[memory/query] claude-api-call failed:', err)
    return NextResponse.json({ error: 'AI answer generation failed' }, { status: 503 })
  }

  return NextResponse.json({ answer, sources: allSources, query })
}
