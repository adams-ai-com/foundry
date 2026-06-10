import { test, expect } from '@playwright/test'
import {
  E2E_PREFIX,
  createEnvelope,
  deleteSession,
  envelopeRow,
  mintSession,
  recipientRow,
  uploadJob,
} from './helpers'

test.describe.serial('decline flow', () => {
  let sess: string
  let envelopeId: string
  let token: string

  test.beforeAll(async ({ request }) => {
    sess = await mintSession()
    const jobId = await uploadJob(request, sess)
    const res = await createEnvelope(request, sess, jobId, {
      title: `${E2E_PREFIX} decline flow`,
      recipients: [{ name: 'E2E Decliner', email: 'decliner@pdf-e2e.invalid', order_index: 0 }],
    })
    expect(res.status()).toBe(200)
    envelopeId = (await res.json()).id
    token = (await recipientRow(envelopeId, 0)).token
  })

  test.afterAll(async () => {
    await deleteSession(sess)
  })

  test('required signer declines → envelope voided, reason stored', async ({ request }) => {
    const res = await request.post(`/pdf/api/sign/${token}/decline`, {
      data: { reason: 'E2E decline reason' },
    })
    expect(res.status()).toBe(200)

    const env = await envelopeRow(envelopeId)
    expect(env.status).toBe('voided')

    const rec = await recipientRow(envelopeId, 0)
    expect(rec.declined_at).not.toBeNull()
    expect(rec.decline_reason).toContain('E2E decline reason')
  })

  test('declined link shows already_declined', async ({ request }) => {
    const view = await request.get(`/pdf/api/sign/${token}`)
    const body = await view.json()
    expect(['already_declined', 'This envelope has been voided']).toContain(body.error)
  })

  test('declined link cannot be signed', async ({ request }) => {
    const res = await request.post(`/pdf/api/sign/${token}`, {
      data: { fields: [{ field_id: 'x', field_type: 'signature' }] },
    })
    expect([409, 410]).toContain(res.status())
  })
})
