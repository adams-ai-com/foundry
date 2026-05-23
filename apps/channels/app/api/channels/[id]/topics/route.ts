import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const rows = await db`
    SELECT id, name, created_by, created_at, last_message_at, message_count, is_resolved
    FROM channel_topics
    WHERE channel_id = ${id} AND org_id = ${session.orgId}
    ORDER BY COALESCE(last_message_at, created_at) DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name } = await req.json() as { name: string }
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const [channel] = await db`
    SELECT id FROM channels WHERE id = ${id} AND org_id = ${session.orgId}
  `
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [topic] = await db`
    INSERT INTO channel_topics (channel_id, org_id, name, created_by)
    VALUES (${id}, ${session.orgId}, ${name.trim()}, ${session.userId})
    RETURNING id, name, created_by, created_at, last_message_at, message_count, is_resolved
  `
  return NextResponse.json(topic, { status: 201 })
}
