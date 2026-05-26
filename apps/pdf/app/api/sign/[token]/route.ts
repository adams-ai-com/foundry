import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/tokens'
import { db } from '@/lib/db'
import { fetchProc } from '@/lib/proc'
import { generateToken, generateExpiryTimestamp } from '@/lib/tokens'
import { fireSigningWebhook } from '@/lib/webhook'

type Params = { params: Promise<{ token: string }> }

// ── Shared token validation ───────────────────────────────────────────────────

async function validateToken(token: string) {
  const payload = verifyToken(token)
  if (!payload) return null

  const rows = await db`
    SELECT
      r.id AS recipient_id, r.envelope_id, r.name AS recipient_name,
      r.email AS recipient_email, r.status AS recipient_status,
      r.token_used, r.order_index,
      e.title, e.status AS envelope_status, e.creator_name, e.creator_email,
      e.expires_at, e.page_count, e.metadata
    FROM envelope_recipients r
    JOIN envelopes e ON e.id = r.envelope_id
    WHERE r.id = ${payload.r} AND e.id = ${payload.e}
  `
  return rows[0] ?? null
}

// ── GET /api/sign/[token] — signing data for the public signing page ──────────

export async function GET(_: NextRequest, { params }: Params) {
  const { token } = await params
  const ctx = await validateToken(token)
  if (!ctx) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })

  if (ctx.envelope_status === 'voided') {
    return NextResponse.json({ error: 'This envelope has been voided' }, { status: 410 })
  }
  if (ctx.envelope_status === 'complete') {
    return NextResponse.json({ error: 'already_complete', title: ctx.title }, { status: 200 })
  }
  if (ctx.recipient_status === 'signed') {
    return NextResponse.json({ error: 'already_signed' }, { status: 200 })
  }
  if (ctx.recipient_status === 'pending') {
    return NextResponse.json({ error: 'not_your_turn', title: ctx.title }, { status: 200 })
  }
  if (ctx.recipient_status === 'declined') {
    return NextResponse.json({ error: 'already_declined', title: ctx.title }, { status: 200 })
  }
  if (ctx.token_used) {
    return NextResponse.json({ error: 'Link already used' }, { status: 410 })
  }

  // Fetch fields for this recipient
  const fields = await db`
    SELECT id, page, x0, y0, x1, y1, field_type, required, completed
    FROM envelope_fields
    WHERE recipient_id = ${ctx.recipient_id}
    ORDER BY page, y0, x0
  `

  // Fetch page dimensions from proc
  const infoRes = await fetchProc(`/envelope-sign/info/${ctx.envelope_id}`)
  const info = infoRes.ok ? await infoRes.json() : { pageCount: ctx.page_count, pages: [] }

  // Mark as viewed (idempotent)
  await db`
    UPDATE envelope_recipients
    SET viewed_at = COALESCE(viewed_at, now())
    WHERE id = ${ctx.recipient_id}
  `

  const metaBranding = (ctx as any).metadata?.branding
  const branding = {
    display_name: metaBranding?.display_name || process.env.SIGNING_PAGE_DISPLAY_NAME || 'Foundry PDF',
    logo_url: metaBranding?.logo_url || process.env.SIGNING_PAGE_LOGO_URL || '',
    brand_color: metaBranding?.brand_color || process.env.SIGNING_PAGE_BRAND_COLOR || '#2563eb',
  }

  return NextResponse.json({
    envelope_id: ctx.envelope_id,
    title: ctx.title,
    creator_name: ctx.creator_name,
    expires_at: ctx.expires_at,
    recipient_id: ctx.recipient_id,
    recipient_name: ctx.recipient_name,
    recipient_email: ctx.recipient_email,
    fields,
    page_count: info.pageCount,
    pages: info.pages,
    status: 'ready',
    branding,
  })
}

// ── POST /api/sign/[token] — submit signature ─────────────────────────────────

interface FieldSubmission {
  field_id: string
  field_type: 'signature' | 'initials' | 'date' | 'name'
  image_b64?: string
  text?: string
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  const ctx = await validateToken(token)
  if (!ctx) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })

  if (ctx.envelope_status === 'voided') {
    return NextResponse.json({ error: 'Envelope voided' }, { status: 410 })
  }
  if (ctx.envelope_status === 'complete') {
    return NextResponse.json({ error: 'Envelope already complete' }, { status: 409 })
  }
  if (ctx.recipient_status === 'signed') {
    return NextResponse.json({ error: 'Already signed' }, { status: 409 })
  }
  if (ctx.token_used) {
    return NextResponse.json({ error: 'Link already used' }, { status: 410 })
  }
  if (ctx.recipient_status === 'pending') {
    return NextResponse.json({ error: 'Not your turn yet' }, { status: 409 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = req.headers.get('user-agent') ?? null

  let body: { fields: FieldSubmission[]; signer_name?: string; signer_email?: string; foundry_user_id?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { fields: submissions, signer_name, signer_email, foundry_user_id } = body
  if (!submissions?.length) {
    return NextResponse.json({ error: 'fields required' }, { status: 400 })
  }

  // Validate: all required fields are present
  const requiredFields = await db`
    SELECT id, field_type FROM envelope_fields
    WHERE recipient_id = ${ctx.recipient_id} AND required = true
  `
  for (const rf of requiredFields as any[]) {
    if (rf.field_type === 'date' || rf.field_type === 'name') continue
    const sub = submissions.find(s => s.field_id === rf.id)
    if (!sub?.image_b64) {
      return NextResponse.json({ error: `Field ${rf.id} requires a signature` }, { status: 400 })
    }
  }

  // Call proc to embed signatures
  const embedPayload = {
    recipient_id: ctx.recipient_id,
    signer_name: signer_name ?? ctx.recipient_name,
    signer_email: signer_email ?? ctx.recipient_email,
    reason: `Signed via Foundry PDF envelope ${ctx.envelope_id.slice(0, 8)}`,
    fields: submissions.map(s => ({
      field_id: s.field_id,
      page: 0,      // filled from DB below
      x0: 0, y0: 0, x1: 0, y1: 0,  // filled from DB below
      field_type: s.field_type,
      image_b64: s.image_b64 ?? null,
      text: s.text ?? null,
    })),
  }

  // Enrich with DB field coordinates
  const dbFields = await db`
    SELECT id, page, x0, y0, x1, y1, field_type
    FROM envelope_fields WHERE recipient_id = ${ctx.recipient_id}
  `
  embedPayload.fields = submissions.map(s => {
    const dbf = (dbFields as any[]).find(f => f.id === s.field_id)
    return {
      field_id: s.field_id,
      page: dbf?.page ?? 0,
      x0: dbf?.x0 ?? 0, y0: dbf?.y0 ?? 0,
      x1: dbf?.x1 ?? 200, y1: dbf?.y1 ?? 60,
      field_type: s.field_type,
      image_b64: s.image_b64 ?? null,
      text: s.text ?? null,
    }
  })

  const embedRes = await fetchProc(`/envelope-sign/embed/${ctx.envelope_id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(embedPayload),
  })
  if (!embedRes.ok) {
    const detail = await embedRes.json().catch(() => ({}))
    return NextResponse.json({ error: 'Signing failed', detail }, { status: 502 })
  }
  const embedData = await embedRes.json()

  // Update DB: mark recipient signed, mark token used, mark fields completed
  await db.begin(async sql => {
    await sql`
      UPDATE envelope_recipients
      SET status = 'signed', token_used = true, signed_at = now(),
          cert_fingerprint = ${embedData.cert_fingerprint ?? null},
          ip_address = ${ip}::INET, user_agent = ${ua}
      WHERE id = ${ctx.recipient_id}
    `

    await sql`
      UPDATE envelope_fields SET completed = true
      WHERE recipient_id = ${ctx.recipient_id}
    `

    await sql`
      INSERT INTO signing_events
        (envelope_id, recipient_id, event, ip_address, user_agent, detail)
      VALUES
        (${ctx.envelope_id}, ${ctx.recipient_id}, 'signed',
         ${ip}::INET, ${ua},
         ${{
           cert_fingerprint: embedData.cert_fingerprint,
           ...(foundry_user_id ? { foundry_user_id, foundry_identity: true } : {}),
         } as any})
    `
  })

  // Check if envelope is complete or advance to next order tier
  const remaining = await db`
    SELECT id, order_index, status FROM envelope_recipients
    WHERE envelope_id = ${ctx.envelope_id} AND required = true AND status != 'signed'
    ORDER BY order_index
  `

  if ((remaining as any[]).length === 0) {
    // All required signers done — complete the envelope
    await db`
      UPDATE envelopes SET status = 'complete', completed_at = now()
      WHERE id = ${ctx.envelope_id}
    `
    await db`
      INSERT INTO signing_events (envelope_id, event, detail)
      VALUES (${ctx.envelope_id}, 'completed', ${{} as any})
    `

    // Email creator: all signatures collected
    fireSigningWebhook({
      event: 'signing_complete',
      recipient_email: (ctx as any).creator_email,
      recipient_name: ctx.creator_name,
      document_title: ctx.title,
      envelope_id: ctx.envelope_id,
    })

    return NextResponse.json({ ok: true, envelope_status: 'complete' })
  }

  // Activate next order tier if current tier is fully signed
  const currentTierUnsigned = (remaining as any[]).filter(
    r => r.order_index === ctx.order_index && r.status !== 'signed'
  )
  if (currentTierUnsigned.length === 0) {
    const nextOrder = (remaining as any[])[0]?.order_index
    if (nextOrder !== undefined) {
      const nextRecips = (remaining as any[]).filter(r => r.order_index === nextOrder)
      for (const nr of nextRecips) {
        await db`
          UPDATE envelope_recipients
          SET status = 'active', sent_at = now()
          WHERE id = ${nr.id}
        `
        await db`
          INSERT INTO signing_events (envelope_id, recipient_id, event)
          VALUES (${ctx.envelope_id}, ${nr.id}, 'sent')
        `
        // Email next-tier signer
        const baseUrl = process.env.SIGNING_BASE_URL ?? 'https://foundry.adams-ai.com'
        const nrRows = await db`SELECT token FROM envelope_recipients WHERE id = ${nr.id}`
        const nrToken = (nrRows as any[])[0]?.token
        if (nrToken) {
          fireSigningWebhook({
            event: 'signing_invitation',
            recipient_email: nr.email,
            recipient_name: nr.name,
            document_title: ctx.title,
            creator_name: ctx.creator_name,
            signing_url: `${baseUrl}/pdf/sign/${nrToken}`,
            envelope_id: ctx.envelope_id,
          })
        }
      }
    }
  }

  await db`
    UPDATE envelopes SET status = 'partial' WHERE id = ${ctx.envelope_id} AND status = 'sent'
  `

  return NextResponse.json({ ok: true, envelope_status: 'partial' })
}
