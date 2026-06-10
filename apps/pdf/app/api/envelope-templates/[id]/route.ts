import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// ── GET /api/envelope-templates/[id] ─────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [row] = await db`
    SELECT id, creator_id, name, page_count, recipients, fields, created_at
    FROM envelope_templates WHERE id = ${id}
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.creator_id !== session.userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ template: row })
}

// ── DELETE /api/envelope-templates/[id] ──────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [row] = await db`SELECT creator_id FROM envelope_templates WHERE id = ${id}`
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.creator_id !== session.userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete DB row first, then clean up proc store (best-effort)
  await db`DELETE FROM envelope_templates WHERE id = ${id}`
  await fetchProc(`/template/${id}`, { method: 'DELETE' }).catch(() => {})

  return NextResponse.json({ ok: true })
}
