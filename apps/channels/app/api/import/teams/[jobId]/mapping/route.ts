import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ jobId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const { user_mapping, channel_mapping, include_system_events } = await req.json() as {
    user_mapping: Record<string, string>
    channel_mapping: Record<string, { team_name: string; channel_name: string; foundry_channel_id: string | null; create_new: boolean; new_name: string | null; skip: boolean }>
    include_system_events: boolean
  }
  const [job] = await db`
    UPDATE teams_import_jobs
    SET user_mapping = ${JSON.stringify(user_mapping)},
        channel_mapping = ${JSON.stringify(channel_mapping)},
        include_system_events = ${include_system_events},
        status = 'mapped'
    WHERE id = ${jobId} AND org_id = ${session.orgId} AND status IN ('pending', 'mapped')
    RETURNING id
  `
  if (!job) return NextResponse.json({ error: 'Not found or already running' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
