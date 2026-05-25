import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'
import { db } from '@/lib/db'
import { generateToken, generateExpiryTimestamp } from '@/lib/tokens'

// ── GET /api/envelopes — list creator's envelopes ────────────────────────────

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db`
    SELECT
      e.id, e.title, e.status, e.page_count, e.created_at, e.expires_at, e.completed_at,
      COUNT(r.id)                                           AS total_recipients,
      COUNT(r.id) FILTER (WHERE r.status = 'signed')        AS signed_recipients
    FROM envelopes e
    LEFT JOIN envelope_recipients r ON r.envelope_id = e.id AND r.required = true
    WHERE e.creator_id = ${session.userId}
    GROUP BY e.id
    ORDER BY e.created_at DESC
    LIMIT 100
  `
  return NextResponse.json({ envelopes: rows })
}

// ── POST /api/envelopes — create and immediately send ────────────────────────

interface RecipientInput { name: string; email: string; order_index: number }
interface FieldInput {
  recipient_index: number   // index into recipients array
  page: number; x0: number; y0: number; x1: number; y1: number
  field_type: 'signature' | 'initials' | 'date' | 'name'
  required?: boolean
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    job_id: string
    title: string
    recipients: RecipientInput[]
    fields: FieldInput[]
    expiry_days?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { job_id, title, recipients, fields, expiry_days = 14 } = body

  if (!job_id || !title?.trim()) {
    return NextResponse.json({ error: 'job_id and title required' }, { status: 400 })
  }
  if (!recipients?.length) {
    return NextResponse.json({ error: 'At least one recipient required' }, { status: 400 })
  }
  if (!fields?.length) {
    return NextResponse.json({ error: 'At least one field required' }, { status: 400 })
  }

  // 1. Create envelope ID and copy PDF to persistent store
  const envelopeId = crypto.randomUUID()
  const copyRes = await fetchProc('/envelope-sign/copy-to-store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id, envelope_id: envelopeId }),
  })
  if (!copyRes.ok) {
    const detail = await copyRes.json().catch(() => ({}))
    return NextResponse.json({ error: 'Failed to copy PDF', detail }, { status: 502 })
  }
  const copyData = await copyRes.json()
  const pageCount = copyData.pages?.length ?? 0

  const expiresAt = new Date(Date.now() + expiry_days * 86400_000)
  const expUnix = generateExpiryTimestamp(expiry_days)

  // 2. Determine first active order_index
  const minOrder = Math.min(...recipients.map(r => r.order_index))

  // 3. Generate tokens — active immediately for first order tier, pending for rest
  const recipientsWithTokens = recipients.map((r) => {
    const isActive = r.order_index === minOrder
    return {
      ...r,
      id: crypto.randomUUID(),
      token: generateToken({ r: crypto.randomUUID(), e: envelopeId, exp: expUnix }),
      status: isActive ? 'active' : 'pending',
      sent_at: isActive ? new Date() : null,
    }
  })
  // Fix: token payload must reference the actual recipient ID
  const recipientsWithFinalTokens = recipientsWithTokens.map((r) => ({
    ...r,
    token: generateToken({ r: r.id, e: envelopeId, exp: expUnix }),
  }))

  // 4. Persist everything in a transaction
  await db.begin(async sql => {
    await sql`
      INSERT INTO envelopes (id, job_id, creator_id, creator_name, creator_email, title, status, page_count, expires_at)
      VALUES (${envelopeId}, ${job_id}, ${session.userId}, ${session.name ?? session.email}, ${session.email},
              ${title.trim()}, 'sent', ${pageCount}, ${expiresAt})
    `

    for (const r of recipientsWithFinalTokens) {
      await sql`
        INSERT INTO envelope_recipients (id, envelope_id, name, email, order_index, status, token, sent_at)
        VALUES (${r.id}, ${envelopeId}, ${r.name}, ${r.email}, ${r.order_index},
                ${r.status}, ${r.token}, ${r.sent_at})
      `
    }

    for (const f of fields) {
      const recip = recipientsWithFinalTokens[f.recipient_index]
      if (!recip) continue
      await sql`
        INSERT INTO envelope_fields (envelope_id, recipient_id, page, x0, y0, x1, y1, field_type, required)
        VALUES (${envelopeId}, ${recip.id}, ${f.page}, ${f.x0}, ${f.y0}, ${f.x1}, ${f.y1},
                ${f.field_type}, ${f.required ?? true})
      `
    }

    await sql`
      INSERT INTO signing_events (envelope_id, event, actor, detail)
      VALUES (${envelopeId}, 'created', ${session.userId},
              ${{ recipient_count: recipients.length, field_count: fields.length } as any})
    `
  })

  // 5. Build signing link list for creator
  const baseUrl = process.env.SIGNING_BASE_URL ?? 'https://foundry.adams-ai.com'
  const links = recipientsWithFinalTokens
    .filter(r => r.status === 'active')
    .map(r => ({
      name: r.name,
      email: r.email,
      url: `${baseUrl}/pdf/sign/${r.token}`,
      order_index: r.order_index,
    }))

  return NextResponse.json({ id: envelopeId, links })
}
