import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db`
    SELECT DISTINCT ON (author_id)
      author_id as id,
      author_name as name,
      author_email as email
    FROM channel_messages
    WHERE org_id = ${session.orgId} AND deleted_at IS NULL
    ORDER BY author_id, created_at DESC
  `

  return NextResponse.json(rows)
}
