import type { APIRequestContext } from '@playwright/test'
import postgres from 'postgres'
import { randomBytes } from 'crypto'

export const E2E_PREFIX = '[E2E]'
export const MOCK_URL = 'http://127.0.0.1:3940'

export const pdfDb = postgres(process.env.FOUNDRY_PDF_DB_URL!, { max: 2 })
export const wsDb = postgres(process.env.WORKSPACE_DATABASE_URL!, { max: 2 })

export async function testUser() {
  const [u] = await wsDb`SELECT id FROM users WHERE email = 'john@adams-ai.com'`
  const [m] = await wsDb`SELECT org_id FROM org_members WHERE user_id = ${u.id} LIMIT 1`
  return { userId: u.id as string, orgId: m.org_id as string }
}

export async function mintSession(): Promise<string> {
  const { userId, orgId } = await testUser()
  const id = randomBytes(24).toString('hex')
  await wsDb`
    INSERT INTO sessions (id, user_id, org_id, expires_at, user_agent)
    VALUES (${id}, ${userId}, ${orgId}, now() + interval '1 hour', 'pdf-e2e')`
  return id
}

export async function deleteSession(id: string) {
  await wsDb`DELETE FROM sessions WHERE id = ${id}`
}

export function cookie(sess: string) {
  return { cookie: `foundry_session=${sess}` }
}

// Build a minimal but structurally valid one-page PDF (correct xref offsets).
export function makeTinyPdf(label = 'E2E test doc'): Buffer {
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>/Contents 4 0 R>>',
  ]
  const stream = `BT /F1 12 Tf 72 720 Td (${label}) Tj ET`
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  offsets.push(body.length)
  body += `4 0 obj\n<</Length ${stream.length}>>\nstream\n${stream}\nendstream\nendobj\n`
  const xrefPos = body.length
  body += 'xref\n0 5\n0000000000 65535 f \n'
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<</Size 5/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}

// 1x1 transparent PNG
export const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export async function uploadJob(request: APIRequestContext, sess: string): Promise<string> {
  const res = await request.post('/pdf/api/pdf/upload', {
    headers: cookie(sess),
    multipart: {
      file: { name: 'e2e.pdf', mimeType: 'application/pdf', buffer: makeTinyPdf() },
    },
  })
  if (!res.ok()) throw new Error(`upload failed: ${res.status()} ${await res.text()}`)
  const data = await res.json()
  return data.jobId
}

export interface EnvelopeOpts {
  title: string
  recipients: { name: string; email: string; order_index: number }[]
  expiry_days?: number
}

export async function createEnvelope(
  request: APIRequestContext,
  sess: string,
  jobId: string,
  opts: EnvelopeOpts,
) {
  const fields = opts.recipients.map((_, i) => ({
    recipient_index: i,
    page: 1,
    x0: 100 + i * 220,
    y0: 600,
    x1: 300 + i * 220,
    y1: 650,
    field_type: 'signature' as const,
  }))
  const res = await request.post('/pdf/api/envelopes', {
    headers: cookie(sess),
    data: { job_id: jobId, title: opts.title, recipients: opts.recipients, fields, expiry_days: opts.expiry_days ?? 3 },
  })
  return res
}

export async function recipientRow(envelopeId: string, orderIndex: number) {
  const [r] = await pdfDb`
    SELECT id, email, status, token, token_used, sent_at, signed_at, declined_at, decline_reason
    FROM envelope_recipients
    WHERE envelope_id = ${envelopeId} AND order_index = ${orderIndex}`
  return r
}

export async function envelopeRow(envelopeId: string) {
  const [e] = await pdfDb`
    SELECT id, title, status, expires_at, completed_at FROM envelopes WHERE id = ${envelopeId}`
  return e
}

export async function fieldIdFor(recipientId: string): Promise<string> {
  const [f] = await pdfDb`SELECT id FROM envelope_fields WHERE recipient_id = ${recipientId}`
  return f.id
}

export async function mockEvents(request: APIRequestContext) {
  const res = await request.get(`${MOCK_URL}/events`)
  return (await res.json()) as { event: string; recipient_email: string; signing_url?: string }[]
}

export async function clearMockEvents(request: APIRequestContext) {
  await request.delete(`${MOCK_URL}/events`)
}

// Remove every [E2E]-prefixed artifact. Children first — no FK cascades assumed.
export async function cleanupTestData() {
  await pdfDb`
    DELETE FROM signing_events WHERE envelope_id IN
      (SELECT id FROM envelopes WHERE title LIKE ${E2E_PREFIX + '%'})`
  await pdfDb`
    DELETE FROM envelope_fields WHERE envelope_id IN
      (SELECT id FROM envelopes WHERE title LIKE ${E2E_PREFIX + '%'})`
  await pdfDb`
    DELETE FROM envelope_recipients WHERE envelope_id IN
      (SELECT id FROM envelopes WHERE title LIKE ${E2E_PREFIX + '%'})`
  await pdfDb`DELETE FROM envelopes WHERE title LIKE ${E2E_PREFIX + '%'}`
  await pdfDb`DELETE FROM bulk_sends WHERE title_prefix LIKE ${E2E_PREFIX + '%'}`
  await pdfDb`DELETE FROM envelope_templates WHERE name LIKE ${E2E_PREFIX + '%'}`
  await wsDb`DELETE FROM sessions WHERE user_agent = 'pdf-e2e'`
}
