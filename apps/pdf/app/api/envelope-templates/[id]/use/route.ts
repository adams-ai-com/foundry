import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { fetchProc } from '@/lib/proc'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// ── POST /api/envelope-templates/[id]/use ────────────────────────────────────
// Creates a new editable job from the template PDF.
// Returns { job_id, template } so the editor can pre-populate the wizard.

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [row] = await db`
    SELECT id, creator_id, name, page_count, recipients, fields
    FROM envelope_templates WHERE id = ${id}
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.creator_id !== session.userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const procRes = await fetchProc('/template/make-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: id, filename: `${row.name}.pdf` }),
  })
  if (!procRes.ok) {
    const err = await procRes.json().catch(() => ({}))
    return NextResponse.json({ error: err.detail ?? 'Failed to create job from template' }, { status: 500 })
  }
  const { job_id } = await procRes.json()

  return NextResponse.json({ job_id, template: row })
}
