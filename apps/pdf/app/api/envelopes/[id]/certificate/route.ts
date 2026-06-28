import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { db } from '@/lib/db'
import { fetchProc } from '@/lib/proc'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [envelope] = await db`
    SELECT id, title, status, created_at, completed_at
    FROM envelopes
    WHERE id = ${id} AND creator_id = ${session.userId}
  `
  if (!envelope) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (envelope.status !== 'complete') {
    return NextResponse.json({ error: 'Envelope is not complete' }, { status: 409 })
  }

  const recipients = await db`
    SELECT name, email, order_index, signed_at, ip_address, cert_fingerprint
    FROM envelope_recipients
    WHERE envelope_id = ${id} AND status = 'signed'
    ORDER BY order_index, signed_at
  `

  const events = await db`
    SELECT event, actor, created_at
    FROM signing_events
    WHERE envelope_id = ${id}
    ORDER BY created_at ASC
  `

  const payload = {
    title: envelope.title,
    envelope_id: id,
    created_at: envelope.created_at?.toISOString?.() ?? String(envelope.created_at),
    completed_at: envelope.completed_at?.toISOString?.() ?? null,
    signers: (recipients as any[]).map(r => ({
      name: r.name,
      email: r.email,
      signed_at: r.signed_at?.toISOString?.() ?? null,
      ip_address: r.ip_address ?? null,
      cert_fingerprint: r.cert_fingerprint ?? null,
      order_index: r.order_index,
    })),
    events: (events as any[]).map(e => ({
      event: e.event,
      created_at: e.created_at?.toISOString?.() ?? String(e.created_at),
      actor: e.actor ?? null,
    })),
  }

  const res = await fetchProc(`/envelope-sign/certificate/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Certificate generation failed' }, { status: 502 })
  }

  const pdfBytes = await res.arrayBuffer()
  const safe = envelope.title.replace(/[^a-z0-9\-_ ]/gi, '').trim().slice(0, 40)
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="completion-certificate-${safe}-${id.slice(0, 8)}.pdf"`,
    },
  })
}
