import { test, expect } from '@playwright/test'
import {
  E2E_PREFIX,
  createEnvelope,
  deleteSession,
  mintSession,
  recipientRow,
  uploadJob,
} from './helpers'

test.describe('UI smoke (chromium)', () => {
  let sess: string

  test.beforeAll(async () => {
    sess = await mintSession()
  })

  test.afterAll(async () => {
    await deleteSession(sess)
  })

  test('unauthenticated protected page redirects to login', async ({ page }) => {
    // /pdf itself renders a public shell; /pdf/envelopes is session-gated
    await page.goto('/pdf/envelopes')
    await page.waitForURL(/\/login/, { timeout: 15_000 })
  })

  test('authenticated home page renders', async ({ page, context }) => {
    await context.addCookies([
      { name: 'owl_session', value: sess, url: 'http://127.0.0.1:3019' },
    ])
    await page.goto('/pdf')
    await expect(page.getByText(/envelope|upload|pdf/i).first()).toBeVisible({ timeout: 20_000 })
  })

  test('signer page renders for a live token', async ({ page, request }) => {
    const jobId = await uploadJob(request, sess)
    const res = await createEnvelope(request, sess, jobId, {
      title: `${E2E_PREFIX} ui smoke envelope`,
      recipients: [{ name: 'UI Signer', email: 'ui-signer@pdf-e2e.invalid', order_index: 0 }],
    })
    const envelopeId = (await res.json()).id
    const rec = await recipientRow(envelopeId, 0)

    await page.goto(`/pdf/sign/${rec.token}`)
    await expect(page.getByText(/ui smoke envelope/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
