import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { fetchProc } from '@/lib/proc'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

// ── GET /api/envelope-templates — list creator's templates ───────────────────

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db`
    SELECT id, name, page_count, recipients, fields, created_at
    FROM envelope_templates
    WHERE creator_id = ${session.userId}
    ORDER BY created_at DESC
    LIMIT 100
  `
  return NextResponse.json({ templates: rows })
}

// ── POST /api/envelope-templates — save template ─────────────────────────────

interface RecipientInput {
  name: string; email: string; order_index: number; required: boolean; color: string
}
interface FieldInput {
  recipient_index: number
  page: number; x0: number; y0: number; x1: number; y1: number
  field_type: string; required: boolean
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name: string; job_id: string; recipients: RecipientInput[]; fields: FieldInput[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { name, job_id, recipients, fields } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!job_id) return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
  if (!Array.isArray(recipients) || recipients.length === 0)
    return NextResponse.json({ error: 'At least one recipient is required' }, { status: 400 })

  const templateId = randomUUID()

  // Copy PDF to template store
  const procRes = await fetchProc('/template/copy-from-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id, template_id: templateId }),
  })
  if (!procRes.ok) {
    const err = await procRes.json().catch(() => ({}))
    return NextResponse.json({ error: err.detail ?? 'Failed to store template PDF' }, { status: 500 })
  }
  const { page_count } = await procRes.json()

  await db`
    INSERT INTO envelope_templates (id, creator_id, creator_name, name, page_count, recipients, fields)
    VALUES (
      ${templateId},
      ${session.userId},
      ${session.name ?? session.email ?? session.userId},
      ${name.trim()},
      ${page_count},
      ${db.json(recipients as any)},
      ${db.json((fields ?? []) as any)}
    )
  `

  const [row] = await db`
    SELECT id, name, page_count, recipients, fields, created_at
    FROM envelope_templates WHERE id = ${templateId}
  `
  return NextResponse.json({ template: row }, { status: 201 })
}
