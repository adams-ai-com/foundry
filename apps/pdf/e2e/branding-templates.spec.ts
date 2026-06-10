import { test, expect } from '@playwright/test'
import {
  E2E_PREFIX,
  clearMockEvents,
  cookie,
  deleteSession,
  mintSession,
  mockEvents,
  pdfDb,
  uploadJob,
} from './helpers'

test.describe.serial('branding round-trip + templates + bulk send', () => {
  let sess: string
  let original: any

  test.beforeAll(async ({ request }) => {
    sess = await mintSession()
    const res = await request.get('/pdf/api/envelope-branding', { headers: cookie(sess) })
    original = await res.json()
  })

  test.afterAll(async ({ request }) => {
    // Restore pre-test branding, whatever the tests did
    await request.patch('/pdf/api/envelope-branding', {
      headers: cookie(sess),
      data: {
        display_name: original.display_name ?? '',
        logo_url: original.logo_url ?? '',
        brand_color: original.brand_color ?? '',
      },
    })
    await deleteSession(sess)
  })

  test('branding save → reload → re-read round-trip', async ({ request }) => {
    const patch = await request.patch('/pdf/api/envelope-branding', {
      headers: cookie(sess),
      data: { display_name: `${E2E_PREFIX} Brand`, brand_color: '#112233' },
    })
    expect(patch.ok()).toBeTruthy()

    const reread = await request.get('/pdf/api/envelope-branding', { headers: cookie(sess) })
    const body = await reread.json()
    expect(body.display_name).toBe(`${E2E_PREFIX} Brand`)
    expect(body.brand_color).toBe('#112233')
  })

  let templateId: string

  test('create template from job', async ({ request }) => {
    const jobId = await uploadJob(request, sess)
    const res = await request.post('/pdf/api/envelope-templates', {
      headers: cookie(sess),
      data: {
        name: `${E2E_PREFIX} template`,
        job_id: jobId,
        recipients: [{ name: 'Recipient', email: '', order_index: 0 }],
        fields: [
          { recipient_index: 0, page: 1, x0: 100, y0: 600, x1: 300, y1: 650, field_type: 'signature' },
        ],
      },
    })
    expect(res.status()).toBe(201)
    templateId = (await res.json()).template.id
  })

  let bulkId: string

  test('bulk send creates drafts only — no emails fired', async ({ request }) => {
    await clearMockEvents(request)
    const res = await request.post('/pdf/api/envelopes/bulk-sends', {
      headers: cookie(sess),
      data: {
        template_id: templateId,
        title_prefix: `${E2E_PREFIX} bulk`,
        csv_text: 'name,email\nBulk One,bulk-one@pdf-e2e.invalid\nBulk Two,bulk-two@pdf-e2e.invalid',
      },
    })
    expect(res.ok()).toBeTruthy()
    bulkId = (await res.json()).bulk_id
    expect(bulkId).toBeTruthy()

    const drafts = await pdfDb`
      SELECT status FROM envelopes WHERE bulk_send_id = ${bulkId}`
    expect(drafts).toHaveLength(2)
    expect(drafts.every((d: any) => d.status === 'draft')).toBe(true)

    // Drafts are excluded from the dashboard list
    const list = await request.get('/pdf/api/envelopes', { headers: cookie(sess) })
    const { envelopes } = await list.json()
    expect(envelopes.filter((e: any) => e.bulk_send_id === bulkId)).toHaveLength(0)

    // And crucially: nothing was "emailed"
    const evts = await mockEvents(request)
    expect(evts.filter((e) => e.event === 'signing_invitation')).toHaveLength(0)
  })

  test('explicit send trigger fires invitations and flips drafts to sent', async ({ request }) => {
    test.skip(!bulkId, 'bulk send id not captured')
    const res = await request.post(`/pdf/api/envelopes/bulk-sends/${bulkId}/send`, {
      headers: cookie(sess),
    })
    expect(res.ok()).toBeTruthy()

    await expect
      .poll(
        async () => {
          const evts = await mockEvents(request)
          return evts.filter((e) => e.event === 'signing_invitation').length
        },
        { timeout: 30_000 },
      )
      .toBe(2)

    await expect
      .poll(async () => {
        const rows = await pdfDb`
          SELECT status FROM envelopes WHERE bulk_send_id = ${bulkId}`
        return rows.every((r: any) => r.status === 'sent')
      }, { timeout: 30_000 })
      .toBe(true)
  })
})
