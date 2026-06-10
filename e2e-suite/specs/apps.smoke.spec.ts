import { test, expect } from '@playwright/test'
import { mintSession } from '@foundry/e2e'

// One smoke block per Foundry app: the service answers, and an authenticated
// browser session renders a real page (no 5xx, non-empty body).
// Deep per-app suites live in each app's own e2e/ directory (see apps/pdf/e2e).

interface AppTarget {
  name: string
  base: string
  home: string
  /** loose content expectation on the authed page */
  marker?: RegExp
}

const APPS: AppTarget[] = [
  { name: 'workspace', base: 'http://127.0.0.1:3000', home: '/', marker: /foundry/i },
  { name: 'docs', base: 'http://127.0.0.1:3001', home: '/docs', marker: /docs|document/i },
  { name: 'sheets', base: 'http://127.0.0.1:3002', home: '/sheets', marker: /sheet/i },
  { name: 'mail', base: 'http://127.0.0.1:3004', home: '/mail', marker: /mail|inbox/i },
  { name: 'wiki', base: 'http://127.0.0.1:3005', home: '/wiki', marker: /wiki|page/i },
  { name: 'charts', base: 'http://127.0.0.1:3006', home: '/' },
  { name: 'sites', base: 'http://127.0.0.1:3007', home: '/sites' },
  { name: 'channels', base: 'http://127.0.0.1:3008', home: '/' },
  { name: 'pdf', base: 'http://127.0.0.1:3009', home: '/pdf', marker: /pdf|upload|envelope/i },
]

let sess: string

test.beforeAll(async () => {
  sess = await mintSession()
})

for (const app of APPS) {
  test.describe(app.name, () => {
    test(`${app.name}: service responds`, async ({ request }) => {
      const res = await request.get(`${app.base}${app.home}`, { maxRedirects: 0 })
      expect([200, 307, 308, 302]).toContain(res.status())
    })

    test(`${app.name}: authenticated page renders`, async ({ page, context }) => {
      await context.addCookies([{ name: 'foundry_session', value: sess, url: app.base }])
      const res = await page.goto(`${app.base}${app.home}`)
      expect(res, 'navigation returned a response').toBeTruthy()
      expect(res!.status(), `${app.name} authed page status`).toBeLessThan(500)
      await expect(page.locator('body')).toContainText(/.+/, { timeout: 15_000 })
      if (app.marker && res!.status() < 400) {
        await expect(page.locator('body')).toContainText(app.marker)
      }
    })
  })
}

// ── Service-specific checks ──────────────────────────────────────────────────

test.describe('mailserver (API, port 3100)', () => {
  test('health endpoint is up', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:3100/health')
    expect(res.status()).toBe(200)
  })

  test('API rejects unauthenticated requests', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:3100/api/v1/threads')
    expect([401, 403]).toContain(res.status())
  })
})

test.describe('pdf-proc (API, port 3200)', () => {
  test('health endpoint is up', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:3200/health')
    expect(res.status()).toBe(200)
  })

  test('API rejects requests without proc secret', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:3200/list')
    expect(res.status()).toBe(401)
  })
})

test.describe('auth shell', () => {
  test('workspace login page renders', async ({ page }) => {
    const res = await page.goto('http://127.0.0.1:3000/login')
    expect(res!.status()).toBeLessThan(400)
    await expect(page.locator('body')).toContainText(/sign in|email|log ?in/i)
  })

  test('protected app route without session redirects to login', async ({ page }) => {
    await page.goto('http://127.0.0.1:3009/pdf/envelopes')
    await page.waitForURL(/\/login/, { timeout: 15_000 })
  })
})
