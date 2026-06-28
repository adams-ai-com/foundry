import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; topicId: string }> }

type SummaryResult = {
  bullets: string[]
  action_items: string[]
  generated_at: string
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topicId } = await params
  const [topic] = await db`
    SELECT summary FROM channel_topics
    WHERE id = ${topicId} AND org_id = ${session.orgId}
  `
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(topic.summary ?? null)
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // OpenAI-compatible config — works with Ollama, OpenAI, Groq, Anthropic compat, etc.
  const aiBaseUrl = process.env.AI_BASE_URL   // e.g. http://localhost:11434/v1
  const aiModel   = process.env.AI_MODEL      // e.g. llama3.1:8b
  const aiApiKey  = process.env.AI_API_KEY    // optional for local Ollama

  if (!aiBaseUrl || !aiModel) {
    return NextResponse.json({ error: 'AI features not configured' }, { status: 503 })
  }

  const { id, topicId } = await params

  const [topicRow] = await db`
    SELECT t.name FROM channel_topics t
    JOIN channels c ON c.id = t.channel_id
    WHERE t.id = ${topicId} AND t.channel_id = ${id} AND c.org_id = ${session.orgId}
  `
  if (!topicRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const messages = await db`
    SELECT author_name, body, created_at
    FROM channel_messages
    WHERE topic_id = ${topicId} AND org_id = ${session.orgId} AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 200
  `

  if (messages.length === 0) {
    return NextResponse.json({ error: 'No messages to summarize' }, { status: 422 })
  }

  type MsgRow = { author_name: string; body: string; created_at: string }
  const transcript = (messages as unknown as MsgRow[])
    .map(m => `[${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${m.author_name}: ${m.body}`)
    .join('\n')

  const prompt = `You are summarizing a team chat discussion titled "${topicRow.name}".

Here is the full conversation:
${transcript}

Return ONLY a JSON object with this exact shape:
{
  "bullets": ["bullet 1", "bullet 2", "bullet 3"],
  "action_items": ["action item 1", "action item 2"]
}

Rules:
- bullets: 3-5 concise bullet points covering what was discussed and decided
- action_items: specific tasks or next steps mentioned, or empty array if none
- No markdown, no explanation — just the JSON object`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (aiApiKey) headers['Authorization'] = `Bearer ${aiApiKey}`

  const res = await fetch(`${aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: aiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      temperature: 0.3,
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'AI request failed' }, { status: 502 })

  const aiData = await res.json() as { choices: { message: { content: string } }[] }
  const text = aiData.choices?.[0]?.message?.content ?? ''

  let parsed: { bullets: string[]; action_items: string[] }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch?.[0] ?? text)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
  }

  const summary: SummaryResult = {
    bullets: parsed.bullets ?? [],
    action_items: parsed.action_items ?? [],
    generated_at: new Date().toISOString(),
  }

  await db`
    UPDATE channel_topics SET summary = ${JSON.stringify(summary)}::jsonb
    WHERE id = ${topicId} AND org_id = ${session.orgId}
  `

  return NextResponse.json(summary)
}
