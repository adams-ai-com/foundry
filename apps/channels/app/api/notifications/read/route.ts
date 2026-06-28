import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json() as { ids?: string[] }

  if (ids && ids.length > 0) {
    await db`
      UPDATE channel_notifications SET read_at = now()
      WHERE id = ANY(${ids}) AND user_id = ${session.userId}
    `
  } else {
    await db`
      UPDATE channel_notifications SET read_at = now()
      WHERE user_id = ${session.userId} AND org_id = ${session.orgId} AND read_at IS NULL
    `
  }

  return NextResponse.json({ ok: true })
}
