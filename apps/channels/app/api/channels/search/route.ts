import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'
import { embedText, pgVector } from '@/lib/embed'
import { isGuardianConfigured } from '@/lib/guardian'

export const dynamic = 'force-dynamic'

const MAX_RESULTS = 20
const EXCERPT_LEN = 280

function excerpt(text: string): string {
  return text.length > EXCERPT_LEN ? text.slice(0, EXCERPT_LEN) + '…' : text
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 })

  if (!isGuardianConfigured()) {
    return NextResponse.json({
      results: [],
      note: 'Semantic search requires Guardian to be configured (GUARDIAN_SHARED_SECRET).',
    })
  }

  const queryVec = await embedText(q)
  if (!queryVec) {
    return NextResponse.json({ error: 'Embedding failed — check Guardian/llmbox-srv connection' }, { status: 503 })
  }

  const vecLiteral = pgVector(queryVec)

  // Search channel messages
  const messages = await db`
    SELECT
      'message'   AS source_type,
      cm.id       AS source_id,
      cm.channel_id,
      cm.topic_id,
      cm.author_name,
      cm.body     AS text,
      cm.created_at,
      ct.name     AS topic_name,
      c.name      AS channel_name,
      1 - (cm.embedding <=> ${vecLiteral}::vector) AS score
    FROM channel_messages cm
    JOIN channel_topics ct ON ct.id = cm.topic_id
    JOIN channels c ON c.id = cm.channel_id
    WHERE cm.org_id = ${session.orgId}
      AND cm.embedding IS NOT NULL
      AND cm.deleted_at IS NULL
    ORDER BY cm.embedding <=> ${vecLiteral}::vector
    LIMIT ${MAX_RESULTS}
  ` as {
    source_type: string; source_id: string; channel_id: string; topic_id: string
    author_name: string; text: string; created_at: string
    topic_name: string; channel_name: string; score: number
  }[]

  // Search video transcripts
  const transcripts = await db`
    SELECT
      'transcript'   AS source_type,
      vt.id          AS source_id,
      vt.call_id,
      vc.title       AS call_title,
      vc.channel_id,
      vc.topic_id,
      vt.transcript_text AS text,
      vt.processed_at AS created_at,
      1 - (vt.embedding <=> ${vecLiteral}::vector) AS score
    FROM video_transcripts vt
    JOIN video_calls vc ON vc.id = vt.call_id
    WHERE vc.org_id = ${session.orgId}
      AND vt.embedding IS NOT NULL
    ORDER BY vt.embedding <=> ${vecLiteral}::vector
    LIMIT ${MAX_RESULTS}
  ` as {
    source_type: string; source_id: string; call_id: string; call_title: string
    channel_id: string | null; topic_id: string | null; text: string
    created_at: string; score: number
  }[]

  // Merge + re-rank by score, take top MAX_RESULTS
  const combined = [
    ...messages.map(r => ({
      source_type: r.source_type,
      source_id:   r.source_id,
      channel_id:  r.channel_id,
      topic_id:    r.topic_id,
      channel_name: r.channel_name,
      topic_name:  r.topic_name,
      author_name: r.author_name,
      call_title:  null as string | null,
      call_id:     null as string | null,
      excerpt:     excerpt(r.text),
      created_at:  r.created_at,
      score:       Number(r.score),
    })),
    ...transcripts.map(r => ({
      source_type: r.source_type,
      source_id:   r.source_id,
      channel_id:  r.channel_id,
      topic_id:    r.topic_id,
      channel_name: null as string | null,
      topic_name:  null as string | null,
      author_name: null as string | null,
      call_title:  r.call_title,
      call_id:     r.call_id,
      excerpt:     excerpt(r.text),
      created_at:  r.created_at,
      score:       Number(r.score),
    })),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)

  return NextResponse.json({ results: combined, query: q })
}
