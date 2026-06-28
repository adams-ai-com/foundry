import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { randomBytes } from 'node:crypto'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; topicId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, topicId } = await params
  const { email, name } = await req.json() as { email: string; name?: string }
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Verify channel + topic belong to this org
  const [topic] = await db`
    SELECT t.id, t.name, c.name as channel_name
    FROM channel_topics t
    JOIN channels c ON c.id = t.channel_id
    WHERE t.id = ${topicId} AND t.channel_id = ${id} AND c.org_id = ${session.orgId}
  `
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await db`
    INSERT INTO channel_connect_invites
      (org_id, channel_id, topic_id, token, email, name, invited_by, expires_at)
    VALUES
      (${session.orgId}, ${id}, ${topicId}, ${token}, ${email.trim().toLowerCase()},
       ${name?.trim() ?? null}, ${session.userId}, ${expiresAt})
  `

  const baseUrl = process.env.FOUNDRY_WORKSPACE_URL ?? ''
  return NextResponse.json({
    inviteUrl:   `${baseUrl}/connect/invite/${token}`,
    token,
    expiresAt:   expiresAt.toISOString(),
    topicName:   topic.name,
    channelName: topic.channel_name,
  }, { status: 201 })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, topicId } = await params

  const guests = await db`
    SELECT g.id, g.name, g.email, a.granted_at, a.revoked_at
    FROM channel_connect_guests g
    JOIN channel_connect_access a ON a.guest_id = g.id
    WHERE a.topic_id = ${topicId} AND a.channel_id = ${id}
      AND g.org_id = ${session.orgId}
    ORDER BY a.granted_at DESC
  `

  return NextResponse.json(guests)
}
