import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@owl/auth'
import { db } from '@/lib/db'
import { fetchProc } from '@/lib/proc'
import { generateToken, generateExpiryTimestamp } from '@/lib/tokens'

type Params = { params: Promise<{ id: string }> }

// ── GET /api/envelopes/[id] — envelope detail ────────────────────────────────

export async function GET(_: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [envelope] = await db`
    SELECT * FROM envelopes WHERE id = ${id} AND creator_id = ${session.userId}
  `
  if (!envelope) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const recipients = await db`
    SELECT id, name, email, order_index, required, status, token_used,
           sent_at, viewed_at, signed_at, cert_fingerprint
    FROM envelope_recipients
    WHERE envelope_id = ${id}
    ORDER BY order_index, name
  `

  const fields = await db`
    SELECT id, recipient_id, page, x0, y0, x1, y1, field_type, required, completed
    FROM envelope_fields
    WHERE envelope_id = ${id}
    ORDER BY page, y0, x0
  `

  const events = await db`
    SELECT event, actor, detail, created_at
    FROM signing_events
    WHERE envelope_id = ${id}
    ORDER BY created_at ASC
  `

  const baseUrl = process.env.SIGNING_BASE_URL ?? 'https://foundry.adams-ai.com'

  // Build signing links only for active (unsent / pending) recipients
  const recipientsWithLinks = (recipients as any[]).map(r => ({
    ...r,
    signing_url: r.status === 'active' && !r.token_used
      ? `${baseUrl}/pdf/sign/${r.token ?? ''}`
      : null,
  }))

  return NextResponse.json({
    envelope,
    recipients: recipientsWithLinks,
    fields,
    events,
  })
}

// ── DELETE /api/envelopes/[id] — void an envelope ────────────────────────────

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [envelope] = await db`
    SELECT status FROM envelopes WHERE id = ${id} AND creator_id = ${session.userId}
  `
  if (!envelope) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (envelope.status === 'complete') {
    return NextResponse.json({ error: 'Cannot void a completed envelope' }, { status: 409 })
  }

  await db.begin(async sql => {
    await sql`UPDATE envelopes SET status = 'voided' WHERE id = ${id}`
    await sql`UPDATE envelope_recipients SET status = 'voided' WHERE envelope_id = ${id}`
    await sql`
      INSERT INTO signing_events (envelope_id, event, actor)
      VALUES (${id}, 'voided', ${session.userId})
    `
  })

  return NextResponse.json({ ok: true })
}

// ── POST /api/envelopes/[id]/resend — generate fresh token for one recipient ─

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [envelope] = await db`
    SELECT id, status, expires_at FROM envelopes
    WHERE id = ${id} AND creator_id = ${session.userId}
  `
  if (!envelope) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['sent', 'partial'].includes(envelope.status)) {
    return NextResponse.json({ error: 'Envelope not active' }, { status: 409 })
  }

  const { recipient_id } = await req.json().catch(() => ({}))
  if (!recipient_id) return NextResponse.json({ error: 'recipient_id required' }, { status: 400 })

  const [recip] = await db`
    SELECT id, status FROM envelope_recipients
    WHERE id = ${recipient_id} AND envelope_id = ${id}
  `
  if (!recip) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
  if (recip.status === 'signed') {
    return NextResponse.json({ error: 'Recipient already signed' }, { status: 409 })
  }

  // Generate new token with original expiry or 7 more days
  const expUnix = envelope.expires_at
    ? Math.floor(new Date(envelope.expires_at).getTime() / 1000)
    : generateExpiryTimestamp(7)
  const newToken = generateToken({ r: recipient_id, e: id, exp: expUnix })

  await db`
    UPDATE envelope_recipients
    SET token = ${newToken}, token_used = false, status = 'active', sent_at = now()
    WHERE id = ${recipient_id}
  `

  const baseUrl = process.env.SIGNING_BASE_URL ?? 'https://foundry.adams-ai.com'
  return NextResponse.json({ url: `${baseUrl}/pdf/sign/${newToken}` })
}
