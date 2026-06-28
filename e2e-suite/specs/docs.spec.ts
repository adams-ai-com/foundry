import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'
import { E2E_PREFIX, cookieHeader, dbFromEnvFile, dbFromUrl, mintSession } from '@owl/e2e'

const BASE = process.env.DOCS_BASE ?? 'http://127.0.0.1:4101'
const ENV = '/var/www/foundry/apps/docs/.env'

const TIPTAP_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'E2E seeded content' }] }],
}

test.describe.serial('docs', () => {
  let sess: string
  let docId: string
  const db = () =>
    process.env.DOCS_DB_URL ? dbFromUrl(process.env.DOCS_DB_URL) : dbFromEnvFile(ENV)

  test.beforeAll(async () => {
    sess = await mintSession()
    docId = randomUUID()
    await db()`
      INSERT INTO documents (id, title, content)
      VALUES (${docId}, ${E2E_PREFIX + ' doc'}, ${db().json(TIPTAP_DOC as any)})`
  })

  test.afterAll(async () => {
    await db()`DELETE FROM document_comments WHERE document_id = ${docId}`
    await db()`DELETE FROM document_versions WHERE document_id = ${docId}`
    await db()`DELETE FROM documents WHERE id = ${docId}`
  })

  test('doc list shows the seeded document', async ({ page, context }) => {
    await context.addCookies([{ name: 'owl_session', value: sess, url: BASE }])
    await page.goto(`${BASE}/docs`)
    await expect(page.getByText(`${E2E_PREFIX} doc`).first()).toBeVisible({ timeout: 15_000 })
  })

  test('editor opens the seeded document', async ({ page, context }) => {
    await context.addCookies([{ name: 'owl_session', value: sess, url: BASE }])
    const res = await page.goto(`${BASE}/docs/editor/${docId}`)
    expect(res!.status()).toBeLessThan(400)
    await expect(page.getByText(/E2E seeded content|\[E2E\] doc/).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('comment add → list → resolve round-trip', async ({ request }) => {
    const add = await request.post(`${BASE}/docs/api/comments/${docId}`, {
      headers: cookieHeader(sess),
      data: { content: `${E2E_PREFIX} comment` },
    })
    expect(add.ok()).toBeTruthy()

    const list = await request.get(`${BASE}/docs/api/comments/${docId}`, {
      headers: cookieHeader(sess),
    })
    expect(list.ok()).toBeTruthy()
    const body = await list.json()
    const comments = Array.isArray(body) ? body : body.comments
    const mine = comments.find((c: any) => (c.content ?? '').includes(`${E2E_PREFIX} comment`))
    expect(mine).toBeTruthy()

    const resolve = await request.post(
      `${BASE}/docs/api/comments/${docId}/resolve/${mine.id}`,
      { headers: cookieHeader(sess) },
    )
    expect(resolve.status()).toBeLessThan(400)
    const [row] = await db()`SELECT resolved FROM document_comments WHERE id = ${mine.id}`
    expect(row.resolved).toBe(true)
  })

  test('versions endpoint answers', async ({ request }) => {
    const res = await request.get(`${BASE}/docs/api/versions/${docId}`, {
      headers: cookieHeader(sess),
    })
    expect(res.status()).toBeLessThan(400)
  })

  test('docx export produces a file', async ({ request }) => {
    const res = await request.get(`${BASE}/docs/api/export/${docId}`, {
      headers: cookieHeader(sess),
    })
    expect(res.status()).toBe(200)
    const buf = await res.body()
    expect(buf.length).toBeGreaterThan(100)
  })

  test('comment API rejects unauthenticated writes', async ({ request }) => {
    const res = await request.post(`${BASE}/docs/api/comments/${docId}`, {
      data: { content: 'nope' },
      maxRedirects: 0,
    })
    expect([302, 307, 401, 403]).toContain(res.status())
  })
})
