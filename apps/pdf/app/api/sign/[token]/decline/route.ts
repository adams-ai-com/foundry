import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/tokens'
import { db } from '@/lib/db'
import { fireSigningWebhook } from '@/lib/webhook'

type Params = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })

  const rows = await db`
    SELECT
      r.id AS recipient_id, r.envelope_id, r.name AS recipient_name,
      r.email AS recipient_email, r.status AS recipient_status,
      r.required, r.order_index,
      e.title, e.status AS envelope_status, e.creator_name, e.creator_email,
      e.metadata
    FROM envelope_recipients r
    JOIN envelopes e ON e.id = r.envelope_id
    WHERE r.id = ${payload.r} AND e.id = ${payload.e}
  `
  const ctx = rows[0]
  if (!ctx) return NextResponse.json({ error: 'Invalid link' }, { status: 401 })

  if (ctx.envelope_status === 'voided') {
    return NextResponse.json({ error: 'Envelope already voided' }, { status: 410 })
  }
  if (ctx.envelope_status === 'complete') {
    return NextResponse.json({ error: 'Envelope already complete' }, { status: 409 })
  }
  if (ctx.recipient_status === 'signed') {
    return NextResponse.json({ error: 'Already signed — cannot decline' }, { status: 409 })
  }
  if (ctx.recipient_status === 'declined') {
    return NextResponse.json({ error: 'Already declined' }, { status: 409 })
  }
  if (ctx.recipient_status !== 'active') {
    return NextResponse.json({ error: 'Not your turn yet' }, { status: 409 })
  }

  let body: { reason?: string } = {}
  try { body = await req.json() } catch { /* reason is optional */ }
  const reason = body.reason?.trim() || null

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = req.headers.get('user-agent') ?? null

  // Mark recipient declined and (if required) void the entire envelope
  await db.begin(async sql => {
    await sql`
      UPDATE envelope_recipients
      SET status = 'declined', declined_at = now(), decline_reason = ${reason}
      WHERE id = ${ctx.recipient_id}
    `
    await sql`
      INSERT INTO signing_events (envelope_id, recipient_id, event, ip_address, user_agent, detail)
      VALUES (${ctx.envelope_id}, ${ctx.recipient_id}, 'declined',
              ${ip}::INET, ${ua}, ${{ decline_reason: reason } as any})
    `

    if (ctx.required) {
      // Required signer declined → void envelope + all remaining pending/active recipients
      await sql`
        UPDATE envelope_recipients
        SET status = 'voided'
        WHERE envelope_id = ${ctx.envelope_id}
          AND status IN ('pending', 'active')
          AND id != ${ctx.recipient_id}
      `
      await sql`
        UPDATE envelopes SET status = 'voided' WHERE id = ${ctx.envelope_id}
      `
      await sql`
        INSERT INTO signing_events (envelope_id, event, detail)
        VALUES (${ctx.envelope_id}, 'voided',
                ${{ reason: 'declined', declined_by: ctx.recipient_name,
                    decline_reason: reason } as any})
      `
    }
  })

  // Notify creator
  const metaBranding = (ctx as any).metadata?.branding
  const branding = metaBranding
    ? { display_name: metaBranding.display_name, logo_url: metaBranding.logo_url,
        brand_color: metaBranding.brand_color }
    : undefined

  fireSigningWebhook({
    event: 'signing_declined',
    recipient_email: ctx.creator_email,
    recipient_name: ctx.creator_name,
    document_title: ctx.title,
    envelope_id: ctx.envelope_id,
    decline_reason: reason ?? undefined,
    branding,
  })

  return NextResponse.json({ ok: true, voided: !!ctx.required })
}
