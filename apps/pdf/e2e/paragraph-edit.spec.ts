import { test, expect } from '@playwright/test'
import { mintSession, deleteSession, cookie, uploadJob } from './helpers'

test.describe('paragraph (¶) editing', () => {
  let sess: string
  test.beforeAll(async () => { sess = await mintSession() })
  test.afterAll(async () => { await deleteSession(sess) })

  test('text-blocks → edit-paragraph round-trip, overflow, validation', async ({ request }) => {
    const jobId = await uploadJob(request, sess)

    // 1) blocks load
    let res = await request.get(`/pdf/api/pdf/${jobId}/text-blocks/0`, { headers: cookie(sess) })
    expect(res.ok()).toBeTruthy()
    const blocks = (await res.json()).blocks as Array<{
      text: string; bbox: number[]; font: string; flags: number; size: number
      color: number[]; align: string
    }>
    expect(blocks.length).toBeGreaterThan(0)
    const b0 = blocks[0]
    expect(typeof b0.text).toBe('string')
    expect(b0.bbox).toHaveLength(4)

    // 2) edit the paragraph
    const newText = 'Edited by the paragraph e2e test.'
    res = await request.post(`/pdf/api/pdf/${jobId}/edit-paragraph`, {
      headers: cookie(sess),
      data: { page: 0, bbox: b0.bbox, new_text: newText, font: b0.font,
              flags: b0.flags, size: b0.size, color: b0.color, align: b0.align },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).ok).toBeTruthy()

    // 3) round-trip — new text is persisted
    res = await request.get(`/pdf/api/pdf/${jobId}/text-blocks/0`, { headers: cookie(sess) })
    const afterEdit = ((await res.json()).blocks as Array<{ text: string }>).map(b => b.text).join(' ')
    expect(afterEdit).toContain('Edited by the paragraph e2e test')

    // 4) overflow → 409, and non-destructive (original kept)
    res = await request.post(`/pdf/api/pdf/${jobId}/edit-paragraph`, {
      headers: cookie(sess),
      data: { page: 0, bbox: b0.bbox, new_text: 'word '.repeat(6000),
              font: b0.font, size: b0.size, color: b0.color, align: 'left' },
    })
    expect(res.status()).toBe(409)
    res = await request.get(`/pdf/api/pdf/${jobId}/text-blocks/0`, { headers: cookie(sess) })
    const afterOverflow = ((await res.json()).blocks as Array<{ text: string }>).map(b => b.text).join(' ')
    expect(afterOverflow).toContain('Edited by the paragraph e2e test')

    // 5) server validation — missing bbox → 400
    res = await request.post(`/pdf/api/pdf/${jobId}/edit-paragraph`, {
      headers: cookie(sess),
      data: { page: 0, new_text: 'x' },
    })
    expect(res.status()).toBe(400)
  })

  test('UI: Line/¶ toggle opens the paragraph editor', async ({ page, context, request }) => {
    const jobId = await uploadJob(request, sess)
    await context.addCookies([
      { name: 'owl_session', value: sess, url: 'http://127.0.0.1:3019' },
    ])
    await page.goto(`/pdf/editor/${jobId}`)

    await page.getByRole('button', { name: /edit text/i }).click({ timeout: 20_000 })
    await page.getByRole('button', { name: /paragraph/i }).click()

    const block = page.getByTestId('para-block').first()
    await expect(block).toBeVisible({ timeout: 20_000 })
    await block.click()
    await expect(page.getByTestId('para-editor')).toBeVisible({ timeout: 10_000 })
  })
})
