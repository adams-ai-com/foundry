import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'
import { E2E_PREFIX, dbFromEnvFile, dbFromUrl, mintSession } from '@owl/e2e'

const BASE = process.env.SHEETS_BASE ?? 'http://127.0.0.1:4102'
const ENV = '/var/www/foundry/apps/sheets/.env'

test.describe.serial('sheets', () => {
  let sess: string
  let sheetId: string
  const db = () =>
    process.env.SHEETS_DB_URL ? dbFromUrl(process.env.SHEETS_DB_URL) : dbFromEnvFile(ENV)

  test.beforeAll(async () => {
    sess = await mintSession()
    sheetId = randomUUID()
    await db()`
      INSERT INTO spreadsheets (id, title, data, charts, formats)
      VALUES (${sheetId}, ${E2E_PREFIX + ' sheet'},
              ${db().json({ cells: { A1: { v: 'e2e' } } } as any)},
              ${db().json([] as any)}, ${db().json({} as any)})`
  })

  test.afterAll(async () => {
    await db()`DELETE FROM spreadsheets WHERE id = ${sheetId}`
  })

  test('sheet list shows the seeded spreadsheet', async ({ page, context }) => {
    await context.addCookies([{ name: 'owl_session', value: sess, url: BASE }])
    await page.goto(`${BASE}/sheets`)
    await expect(page.getByText(`${E2E_PREFIX} sheet`).first()).toBeVisible({ timeout: 15_000 })
  })

  test('sheet editor opens', async ({ page, context }) => {
    await context.addCookies([{ name: 'owl_session', value: sess, url: BASE }])
    const res = await page.goto(`${BASE}/sheets/editor/${sheetId}`)
    expect(res!.status()).toBeLessThan(400)
    await expect(page.locator('body')).toContainText(/.+/)
  })

  test('unknown sheet id does not 500', async ({ page, context }) => {
    await context.addCookies([{ name: 'owl_session', value: sess, url: BASE }])
    const res = await page.goto(`${BASE}/sheets/editor/${randomUUID()}`)
    expect(res!.status()).toBeLessThan(500)
  })
})
