import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db`
    SELECT id, name, description, type, is_private, is_archived, created_at
    FROM channels
    WHERE org_id = ${session.orgId} AND is_archived = false
    ORDER BY name ASC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description } = await req.json() as { name: string; description?: string }
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!slug) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })

  try {
    const [channel] = await db`
      INSERT INTO channels (org_id, name, description, created_by)
      VALUES (${session.orgId}, ${slug}, ${description ?? null}, ${session.userId})
      RETURNING id, name, description, type, is_private, is_archived, created_at
    `
    return NextResponse.json(channel, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Channel name already exists' }, { status: 409 })
    }
    throw e
  }
}
