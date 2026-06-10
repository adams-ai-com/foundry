import { test, expect } from '@playwright/test'
import { E2E_PREFIX, cookie, mintSession, deleteSession, uploadJob } from './helpers'

test.describe('envelope creation — server-side validation', () => {
  let sess: string
  let jobId: string

  test.beforeAll(async ({ request }) => {
    sess = await mintSession()
    jobId = await uploadJob(request, sess)
  })

  test.afterAll(async () => {
    await deleteSession(sess)
  })

  test('unauthenticated request is rejected', async ({ request }) => {
    const res = await request.post('/pdf/api/envelopes', {
      data: { title: 'x' },
      maxRedirects: 0,
    })
    expect([307, 401]).toContain(res.status())
  })

  test('missing job_id → 400', async ({ request }) => {
    const res = await request.post('/pdf/api/envelopes', {
      headers: cookie(sess),
      data: {
        title: `${E2E_PREFIX} no job`,
        recipients: [{ name: 'A', email: 'a@e2e.invalid', order_index: 0 }],
        fields: [{ recipient_index: 0, page: 1, x0: 1, y0: 1, x1: 2, y1: 2, field_type: 'signature' }],
      },
    })
    expect(res.status()).toBe(400)
  })

  test('empty recipients → 400', async ({ request }) => {
    const res = await request.post('/pdf/api/envelopes', {
      headers: cookie(sess),
      data: {
        job_id: jobId,
        title: `${E2E_PREFIX} no recipients`,
        recipients: [],
        fields: [{ recipient_index: 0, page: 1, x0: 1, y0: 1, x1: 2, y1: 2, field_type: 'signature' }],
      },
    })
    expect(res.status()).toBe(400)
  })

  test('empty fields → 400', async ({ request }) => {
    const res = await request.post('/pdf/api/envelopes', {
      headers: cookie(sess),
      data: {
        job_id: jobId,
        title: `${E2E_PREFIX} no fields`,
        recipients: [{ name: 'A', email: 'a@e2e.invalid', order_index: 0 }],
        fields: [],
      },
    })
    expect(res.status()).toBe(400)
  })

  test('malformed recipient email → 400', async ({ request }) => {
    const res = await request.post('/pdf/api/envelopes', {
      headers: cookie(sess),
      data: {
        job_id: jobId,
        title: `${E2E_PREFIX} bad email`,
        recipients: [{ name: 'A', email: 'not-an-email', order_index: 0 }],
        fields: [{ recipient_index: 0, page: 1, x0: 1, y0: 1, x1: 2, y1: 2, field_type: 'signature' }],
      },
    })
    expect(res.status()).toBe(400)
  })

  test('bulk send rejects invalid CSV email → 400', async ({ request }) => {
    const res = await request.post('/pdf/api/envelopes/bulk-sends', {
      headers: cookie(sess),
      data: {
        template_id: '00000000-0000-0000-0000-000000000000',
        title_prefix: `${E2E_PREFIX} bulk`,
        csv_text: 'name,email\nBad,definitely-not-an-email',
      },
    })
    expect([400, 404]).toContain(res.status())
  })
})
