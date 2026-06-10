import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'
import { E2E_PREFIX, dbFromEnvFile, dbFromUrl, mintSession } from '@foundry/e2e'

// WIKI_BASE / WIKI_DB_URL override the live-production defaults so the same
// spec can verify a staging container (used by the staging test runner).
const BASE = process.env.WIKI_BASE ?? 'http://127.0.0.1:4105'
const ENV = '/var/www/foundry/apps/wiki/.env'

const TIPTAP_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'E2E wiki body' }] }],
}

test.describe.serial('wiki', () => {
  let sess: string
  let pageId: string
  const db = () =>
    process.env.WIKI_DB_URL ? dbFromUrl(process.env.WIKI_DB_URL) : dbFromEnvFile(ENV)

  test.beforeAll(async () => {
    sess = await mintSession()
    pageId = randomUUID()
    await db()`
      INSERT INTO pages (id, title, content, position, is_home)
      VALUES (${pageId}, ${E2E_PREFIX + ' wiki page'}, ${db().json(TIPTAP_DOC as any)}, 9999, false)`
  })

  test.afterAll(async () => {
    await db()`DELETE FROM pages WHERE id = ${pageId}`
  })

  test('navigation lists the seeded page (dynamic render)', async ({ page, context }) => {
    await context.addCookies([{ name: 'foundry_session', value: sess, url: BASE }])
    await page.goto(`${BASE}/wiki/page/${pageId}`)
    await expect(page.getByText(`${E2E_PREFIX} wiki page`).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('seeded page renders its content', async ({ page, context }) => {
    await context.addCookies([{ name: 'foundry_session', value: sess, url: BASE }])
    const res = await page.goto(`${BASE}/wiki/page/${pageId}`)
    expect(res!.status()).toBeLessThan(400)
    await expect(page.getByText(/E2E wiki body|\[E2E\] wiki page/).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})
