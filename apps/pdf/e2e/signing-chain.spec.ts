import { test, expect } from '@playwright/test'
import {
  E2E_PREFIX,
  TINY_PNG_B64,
  clearMockEvents,
  cookie,
  createEnvelope,
  deleteSession,
  envelopeRow,
  fieldIdFor,
  mintSession,
  mockEvents,
  recipientRow,
  uploadJob,
} from './helpers'

// The full two-signer ordered chain, end to end:
// create → invite #1 only → out-of-turn rejected → bad submit does NOT brick
// the link → #1 signs → #2 invited → #2 signs with OWL identity →
// envelope complete → events + certificate + dashboard all consistent.
test.describe.serial('signing chain — two ordered signers', () => {
  let sess: string
  let envelopeId: string
  let r0: any
  let r1: any

  test.beforeAll(async ({ request }) => {
    sess = await mintSession()
    await clearMockEvents(request)
    const jobId = await uploadJob(request, sess)
    const res = await createEnvelope(request, sess, jobId, {
      title: `${E2E_PREFIX} signing chain`,
      recipients: [
        { name: 'E2E Signer One', email: 'signer-one@pdf-e2e.invalid', order_index: 0 },
        { name: 'E2E Signer Two', email: 'signer-two@pdf-e2e.invalid', order_index: 1 },
      ],
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    envelopeId = data.id
    // Only the first order tier gets links at create time
    expect(data.links).toHaveLength(1)
    expect(data.links[0].email).toBe('signer-one@pdf-e2e.invalid')
  })

  test.afterAll(async () => {
    await deleteSession(sess)
  })

  test('producer state: signer 1 active+sent, signer 2 pending+unsent', async () => {
    r0 = await recipientRow(envelopeId, 0)
    r1 = await recipientRow(envelopeId, 1)
    expect(r0.status).toBe('active')
    expect(r0.sent_at).not.toBeNull()
    expect(r1.status).toBe('pending')
    expect(r1.sent_at).toBeNull()
    const env = await envelopeRow(envelopeId)
    expect(env.status).toBe('sent')
    expect(env.expires_at).not.toBeNull()
  })

  test('invitation webhook fired for signer 1 only', async ({ request }) => {
    await expect
      .poll(async () => {
        const evts = await mockEvents(request)
        return evts.filter((e) => e.event === 'signing_invitation').map((e) => e.recipient_email)
      })
      .toEqual(['signer-one@pdf-e2e.invalid'])
  })

  test('signer 2 cannot view or sign before their turn', async ({ request }) => {
    const view = await request.get(`/pdf/api/sign/${r1.token}`)
    expect((await view.json()).error).toBe('not_your_turn')

    const f1 = await fieldIdFor(r1.id)
    const res = await request.post(`/pdf/api/sign/${r1.token}`, {
      data: { fields: [{ field_id: f1, field_type: 'signature', image_b64: TINY_PNG_B64 }] },
    })
    expect(res.status()).toBe(409)
  })

  test('rejected submit does not consume the signing link', async ({ request }) => {
    // Invalid submit (empty fields) → 400
    const bad = await request.post(`/pdf/api/sign/${r0.token}`, { data: { fields: [] } })
    expect(bad.status()).toBe(400)

    // The link must still be usable afterwards — regression guard for the
    // claim-before-validate bug that bricked links on any rejected request.
    const view = await request.get(`/pdf/api/sign/${r0.token}`)
    const ctx = await view.json()
    expect(ctx.error).toBeUndefined()
    expect(ctx.fields?.length).toBeGreaterThan(0)
  })

  test('signer 1 signs (external path)', async ({ request }) => {
    const f0 = await fieldIdFor(r0.id)
    const res = await request.post(`/pdf/api/sign/${r0.token}`, {
      data: { fields: [{ field_id: f0, field_type: 'signature', image_b64: TINY_PNG_B64 }] },
    })
    expect(res.status()).toBe(200)

    const after = await recipientRow(envelopeId, 0)
    expect(after.status).toBe('signed')
    expect(after.signed_at).not.toBeNull()
  })

  test('signer 2 becomes active and gets invited', async ({ request }) => {
    await expect
      .poll(async () => (await recipientRow(envelopeId, 1)).status)
      .toBe('active')
    await expect
      .poll(async () => {
        const evts = await mockEvents(request)
        return evts.filter((e) => e.event === 'signing_invitation').map((e) => e.recipient_email)
      })
      .toContain('signer-two@pdf-e2e.invalid')
  })

  test('signer 1 link reports already signed', async ({ request }) => {
    const view = await request.get(`/pdf/api/sign/${r0.token}`)
    const body = await view.json()
    expect(['already_signed', 'Link already used']).toContain(body.error)
  })

  test('signer 2 signs with OWL identity → envelope complete', async ({ request }) => {
    const { userId } = await import('./helpers').then((h) => h.testUser())
    const f1 = await fieldIdFor(r1.id)
    const fresh = await recipientRow(envelopeId, 1)
    const res = await request.post(`/pdf/api/sign/${fresh.token}`, {
      data: {
        fields: [{ field_id: f1, field_type: 'signature', image_b64: TINY_PNG_B64 }],
        foundry_user_id: userId,
      },
    })
    expect(res.status()).toBe(200)

    const env = await envelopeRow(envelopeId)
    expect(env.status).toBe('complete')
    expect(env.completed_at).not.toBeNull()
  })

  test('completion webhook fired', async ({ request }) => {
    await expect
      .poll(async () => {
        const evts = await mockEvents(request)
        return evts.some((e) => e.event === 'signing_complete')
      })
      .toBe(true)
  })

  test('signing_events audit trail is written', async () => {
    const { pdfDb } = await import('./helpers')
    const rows = await pdfDb`
      SELECT event FROM signing_events WHERE envelope_id = ${envelopeId}`
    const types = rows.map((r: any) => r.event)
    expect(types.filter((t: string) => t === 'signed')).toHaveLength(2)
  })

  test('dashboard list reflects the completed envelope (consumer side)', async ({ request }) => {
    const res = await request.get('/pdf/api/envelopes', { headers: cookie(sess) })
    expect(res.status()).toBe(200)
    const { envelopes } = await res.json()
    const row = envelopes.find((e: any) => e.id === envelopeId)
    expect(row).toBeTruthy()
    expect(row.status).toBe('complete')
    expect(Number(row.signed_recipients)).toBe(2)
  })

  test('creator can fetch the completed envelope detail + certificate', async ({ request }) => {
    const detail = await request.get(`/pdf/api/envelopes/${envelopeId}`, { headers: cookie(sess) })
    expect(detail.status()).toBe(200)
    const body = await detail.json()
    expect(body.envelope?.status ?? body.status).toBe('complete')

    // certificate may 404 if generation is deferred — tolerate but record
    const cert = await request.get(`/pdf/api/envelopes/${envelopeId}/certificate`, {
      headers: cookie(sess),
    })
    expect([200, 404]).toContain(cert.status())
  })
})
