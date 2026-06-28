import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// ── GET /api/envelopes/bulk-sends/[id] — bulk send status + envelope list ─────

export async function GET(_: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [bulk] = await db`
    SELECT id, template_id, template_name, title_prefix, status, total_count, sent_count, created_at
    FROM bulk_sends
    WHERE id = ${id} AND creator_id = ${session.userId}
  `
  if (!bulk) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const envelopes = await db`
    SELECT e.id, e.title, e.status,
           r.name AS recipient_name, r.email AS recipient_email, r.status AS recipient_status
    FROM envelopes e
    JOIN envelope_recipients r ON r.envelope_id = e.id
    WHERE e.bulk_send_id = ${id}
    ORDER BY r.name
  `

  return NextResponse.json({ bulk, envelopes })
}
