import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ jobId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const [job] = await db`
    SELECT status, messages_imported, users_unmatched,
           attachments_unavailable, error_message, completed_at
    FROM teams_import_jobs WHERE id = ${jobId} AND org_id = ${session.orgId}
  `
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(job)
}
