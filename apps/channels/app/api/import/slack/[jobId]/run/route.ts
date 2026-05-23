import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import db from '@/lib/db'
import { runSlackImport } from '@/lib/slack-importer'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ jobId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params

  const [job] = await db`
    UPDATE slack_import_jobs SET status = 'running', started_at = now()
    WHERE id = ${jobId} AND org_id = ${session.orgId} AND status IN ('pending', 'mapped')
    RETURNING id
  `
  if (!job) return NextResponse.json({ error: 'Not found or already running' }, { status: 409 })

  // Fire-and-forget: run import in background
  void runSlackImport(jobId, session.orgId, session.userId).catch(async (err) => {
    console.error('[slack-import] run failed:', err)
    await db`
      UPDATE slack_import_jobs SET status = 'failed', error_message = ${String(err)}
      WHERE id = ${jobId}
    `.catch(() => {})
  })

  return NextResponse.json({ status: 'running' })
}
