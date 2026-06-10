import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@foundry/auth'
import { fetchProc } from '@/lib/proc'
import { db } from '@/lib/db'
import { generateToken, generateExpiryTimestamp } from '@/lib/tokens'

const MAX_RECIPIENTS = 100

function parseCSV(text: string): { name: string; email: string }[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []

  // Detect header row: first line contains "name" and "email" (case-insensitive)
  let startIdx = 0
  const first = lines[0].toLowerCase()
  if (first.includes('name') && first.includes('email')) startIdx = 1

  const seen = new Set<string>()
  const results: { name: string; email: string }[] = []

  for (const line of lines.slice(startIdx)) {
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''))
    const name = parts[0] || ''
    const email = parts[1] || ''
    if (!name || !email) continue
    const emailLc = email.toLowerCase()
    if (seen.has(emailLc)) continue
    seen.add(emailLc)
    results.push({ name, email })
  }
  return results
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

// ── GET /api/envelopes/bulk-sends — list creator's bulk sends ─────────────────

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db`
    SELECT id, template_name, title_prefix, status, total_count, sent_count, created_at
    FROM bulk_sends
    WHERE creator_id = ${session.userId}
    ORDER BY created_at DESC
    LIMIT 50
  `
  return NextResponse.json({ bulk_sends: rows })
}

// ── POST /api/envelopes/bulk-sends — create draft envelopes, no emails ────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { template_id: string; title_prefix: string; csv_text: string; expiry_days?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { template_id, title_prefix, csv_text, expiry_days = 14 } = body
  if (!template_id?.trim()) return NextResponse.json({ error: 'template_id required' }, { status: 400 })
  if (!title_prefix?.trim()) return NextResponse.json({ error: 'title_prefix required' }, { status: 400 })
  if (!csv_text?.trim()) return NextResponse.json({ error: 'csv_text required' }, { status: 400 })

  // Fetch template
  const [template] = await db`
    SELECT id, creator_id, name, page_count, recipients, fields
    FROM envelope_templates WHERE id = ${template_id}
  `
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  if (template.creator_id !== session.userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Parse CSV
  const recipients = parseCSV(csv_text)
  if (!recipients.length) return NextResponse.json({ error: 'No valid recipients in CSV' }, { status: 400 })

  const invalid = recipients.filter(r => !isValidEmail(r.email))
  if (invalid.length) {
    return NextResponse.json({
      error: `Invalid email addresses: ${invalid.map(r => r.email).slice(0, 3).join(', ')}`,
    }, { status: 400 })
  }

  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `Maximum ${MAX_RECIPIENTS} recipients per bulk send` }, { status: 400 })
  }

  // Snapshot creator's branding
  const [brandingRow] = await db`
    SELECT display_name, logo_url, brand_color FROM signing_branding WHERE creator_id = ${session.userId}
  `
  const branding = {
    display_name: brandingRow?.display_name || (session.name ?? session.email) || '',
    logo_url: brandingRow?.logo_url || process.env.SIGNING_PAGE_LOGO_URL || '',
    brand_color: brandingRow?.brand_color || process.env.SIGNING_PAGE_BRAND_COLOR || '#2563eb',
  }

  const expUnix = generateExpiryTimestamp(expiry_days)
  const expiresAt = new Date(Date.now() + expiry_days * 86400_000)
  const baseUrl = process.env.SIGNING_BASE_URL ?? 'https://foundry.adams-ai.com'

  // Create bulk_sends record + all draft envelopes in one transaction
  const bulkId = crypto.randomUUID()

  interface EnvelopeRecord {
    envelopeId: string
    recipientId: string
    name: string
    email: string
    token: string
    title: string
  }
  const envelopeRecords: EnvelopeRecord[] = []

  for (const r of recipients) {
    const envelopeId = crypto.randomUUID()
    const recipientId = crypto.randomUUID()
    const token = generateToken({ r: recipientId, e: envelopeId, exp: expUnix })
    const title = `${title_prefix.trim()} — ${r.name}`
    envelopeRecords.push({ envelopeId, recipientId, name: r.name, email: r.email, token, title })
  }

  // Copy PDFs for each envelope via proc (template → envelope store directly)
  const pageCount = template.page_count as number
  for (const rec of envelopeRecords) {
    const procRes = await fetchProc('/template/copy-to-envelope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id, envelope_id: rec.envelopeId }),
    })
    if (!procRes.ok) {
      return NextResponse.json({ error: 'Failed to copy PDF for envelope' }, { status: 502 })
    }
  }

  // Persist everything
  await db.begin(async sql => {
    await sql`
      INSERT INTO bulk_sends (id, creator_id, template_id, template_name, title_prefix, status, total_count)
      VALUES (${bulkId}, ${session.userId}, ${template_id}, ${template.name}, ${title_prefix.trim()},
              'ready', ${recipients.length})
    `

    const templateFields = template.fields as Array<{
      page: number; x0: number; y0: number; x1: number; y1: number
      field_type: string; required: boolean; recipient_index: number
    }>

    for (const rec of envelopeRecords) {
      await sql`
        INSERT INTO envelopes (id, job_id, creator_id, creator_name, creator_email, title,
                               status, page_count, expires_at, metadata, bulk_send_id)
        VALUES (${rec.envelopeId}, ${template_id}, ${session.userId},
                ${session.name ?? session.email}, ${session.email},
                ${rec.title}, 'draft', ${pageCount}, ${expiresAt},
                ${sql.json({ branding } as any)}, ${bulkId})
      `

      await sql`
        INSERT INTO envelope_recipients (id, envelope_id, name, email, order_index, status, token)
        VALUES (${rec.recipientId}, ${rec.envelopeId}, ${rec.name}, ${rec.email}, 0, 'pending', ${rec.token})
      `

      for (const f of templateFields) {
        await sql`
          INSERT INTO envelope_fields (envelope_id, recipient_id, page, x0, y0, x1, y1, field_type, required)
          VALUES (${rec.envelopeId}, ${rec.recipientId},
                  ${f.page}, ${f.x0}, ${f.y0}, ${f.x1}, ${f.y1},
                  ${f.field_type}, ${f.required ?? true})
        `
      }

      await sql`
        INSERT INTO signing_events (envelope_id, event, actor, detail)
        VALUES (${rec.envelopeId}, 'created', ${session.userId},
                ${{ bulk_send_id: bulkId } as any})
      `
    }
  })

  const preview = envelopeRecords.map(r => ({
    envelope_id: r.envelopeId,
    name: r.name,
    email: r.email,
    signing_url: `${baseUrl}/pdf/sign/${r.token}`,
  }))

  return NextResponse.json({ bulk_id: bulkId, count: recipients.length, envelopes: preview }, { status: 201 })
}
