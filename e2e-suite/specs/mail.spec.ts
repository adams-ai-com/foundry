import { test, expect } from '@playwright/test'
import { envFileValue, mintSession, testUser } from '@owl/e2e'

// Mailserver REST API (port 3100). Deliberately NO /send coverage — outbound
// goes through the SMTP relay and tests must never send real mail. Send-path
// coverage needs a dedicated mailserver instance with a mocked sender.
const API = 'http://127.0.0.1:3100/api/v1'
import { resolve } from 'path'
const MAIL_ENV = resolve(__dirname, '../../apps/mail/.env')

const apiKey = () => envFileValue(MAIL_ENV, 'MAILSERVER_API_KEY') ?? ''
const accountId = () => envFileValue(MAIL_ENV, 'MAILSERVER_ACCOUNT_ID') ?? ''

function authHeaders(extra: Record<string, string> = {}) {
  return { 'X-API-Key': apiKey(), 'X-Account-Id': accountId(), ...extra }
}

test.describe('mailserver API', () => {
  test('rejects a bad API key', async ({ request }) => {
    const res = await request.get(`${API}/threads`, {
      headers: { 'X-API-Key': 'wrong', 'X-Account-Id': accountId() },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('lists mailboxes for the default account', async ({ request }) => {
    const res = await request.get(`${API}/mailboxes`, { headers: authHeaders() })
    expect(res.status()).toBe(200)
    const body = await res.json()
    const boxes = Array.isArray(body) ? body : body.mailboxes
    expect(boxes.length).toBeGreaterThan(0)
  })

  test('lists inbox threads', async ({ request }) => {
    const res = await request.get(`${API}/threads?mailbox=inbox`, { headers: authHeaders() })
    expect(res.status()).toBe(200)
  })

  test('search answers', async ({ request }) => {
    const res = await request.get(`${API}/search?q=test`, { headers: authHeaders() })
    expect(res.status()).toBeLessThan(500)
  })

  test('unified account listing via X-User-Id', async ({ request }) => {
    const { userId } = await testUser()
    const res = await request.get(`${API}/user-accounts`, {
      headers: { 'X-API-Key': apiKey(), 'X-User-Id': userId },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.accounts ?? body.groups ?? body).toBeTruthy()
  })

  test('message star round-trip (restores original state)', async ({ request }) => {
    const res = await request.get(`${API}/threads?mailbox=inbox&page=1`, {
      headers: authHeaders(),
    })
    const body = await res.json()
    const threads = Array.isArray(body) ? body : body.threads ?? []
    const first = threads[0]
    test.skip(!first, 'no threads in inbox to exercise the round-trip')

    const tRes = await request.get(`${API}/threads/${first.id}`, { headers: authHeaders() })
    expect(tRes.status()).toBe(200)
    const thread = await tRes.json()
    const msg = (thread.messages ?? thread.thread?.messages ?? [])[0]
    test.skip(!msg, 'thread has no messages')

    const original = !!msg.isStarred
    const flip = await request.patch(`${API}/messages/${msg.id}`, {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      data: { isStarred: !original },
    })
    expect(flip.status()).toBeLessThan(400)

    const verify = await request.get(`${API}/threads/${first.id}`, { headers: authHeaders() })
    const after = ((await verify.json()).messages ?? []).find((m: any) => m.id === msg.id)
    if (after) expect(!!after.isStarred).toBe(!original)

    // restore
    await request.patch(`${API}/messages/${msg.id}`, {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      data: { isStarred: original },
    })
  })
})

test.describe('mail client UI', () => {
  test('inbox shell renders with account sidebar', async ({ page, context }) => {
    const sess = await mintSession()
    const base = process.env.MAIL_BASE ?? 'http://127.0.0.1:4104'
    await context.addCookies([{ name: 'owl_session', value: sess, url: base }])
    const res = await page.goto(`${base}/mail`)
    expect(res!.status()).toBeLessThan(400)
    await expect(page.getByText(/inbox/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
