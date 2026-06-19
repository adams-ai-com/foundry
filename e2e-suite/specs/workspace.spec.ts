import { test, expect } from '@playwright/test'
import {
  E2E_TEST_EMAIL,
  E2E_TOTP_EMAIL,
  cookieHeader,
  ensureTestUser,
  mintOtpChallenge,
  mintSession,
  cleanupOtpChallenges,
  wsDb,
} from '@foundry/e2e'

const BASE = process.env.WORKSPACE_BASE ?? 'http://127.0.0.1:4100'

async function submitEmailStep(page: import('@playwright/test').Page, email: string) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[name="email"]', email)
  await page.click('button[type="submit"]')
  await page.waitForSelector('input[name="password"]', { timeout: 15_000 })
}

async function submitCode(page: import('@playwright/test').Page, code: string) {
  await page.fill('input[name="code"]', code)
  await page.click('button[type="submit"]')
}

async function sessionCount(userId: string) {
  const rows = await wsDb()`SELECT id FROM sessions WHERE user_id = ${userId}`
  return rows.length
}

async function pendingChallenges(userId: string) {
  const rows = await wsDb()`
    SELECT id FROM email_otp_challenges
    WHERE user_id = ${userId} AND used_at IS NULL AND expires_at > now()`
  return rows.length
}

test.describe.serial('workspace — login flows', () => {
  let user: { userId: string; email: string; password: string }

  test.beforeAll(async () => {
    user = await ensureTestUser()
  })

  test.afterEach(async () => {
    await cleanupOtpChallenges(user.userId)
    await wsDb()`DELETE FROM sessions WHERE user_id = ${user.userId}`
  })

  test('correct password issues an OTP challenge (no session yet)', async ({ page }) => {
    await submitEmailStep(page, user.email)
    await page.fill('input[name="password"]', user.password)
    await page.click('button[type="submit"]')

    await page.waitForURL(/\/login\/verify/, { timeout: 15_000 })
    expect(await sessionCount(user.userId)).toBe(0)
    expect(await pendingChallenges(user.userId)).toBe(1)
  })

  test('wrong password does not create a session or OTP challenge', async ({ page }) => {
    await submitEmailStep(page, user.email)
    await page.fill('input[name="password"]', 'definitely-wrong-password')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    expect(await sessionCount(user.userId)).toBe(0)
    expect(await pendingChallenges(user.userId)).toBe(0)
  })

  test('OTP verify: valid code establishes a session', async ({ page, context }) => {
    const code = '482917'
    const challengeId = await mintOtpChallenge(user.userId, code)
    await context.addCookies([
      { name: 'foundry_login_email', value: user.email, url: BASE, path: '/' },
      { name: 'foundry_otp_challenge', value: challengeId, url: BASE, path: '/' },
    ])
    await page.goto(`${BASE}/login/verify`)
    await page.waitForSelector('input[name="code"]', { timeout: 15_000 })
    await submitCode(page, code)
    await expect
      .poll(() => sessionCount(user.userId), { timeout: 15_000 })
      .toBeGreaterThan(0)
  })

  test('OTP verify: wrong code is rejected and counted', async ({ page, context }) => {
    const code = '482917'
    const challengeId = await mintOtpChallenge(user.userId, code)
    await context.addCookies([
      { name: 'foundry_login_email', value: user.email, url: BASE, path: '/' },
      { name: 'foundry_otp_challenge', value: challengeId, url: BASE, path: '/' },
    ])
    await page.goto(`${BASE}/login/verify`)
    await page.waitForSelector('input[name="code"]', { timeout: 15_000 })
    await submitCode(page, '000000')
    await expect(page.getByText(/invalid|attempts remaining|try again/i).first()).toBeVisible({
      timeout: 10_000,
    })
    const [row] = await wsDb()`SELECT attempts FROM email_otp_challenges WHERE id = ${challengeId}`
    expect(Number(row.attempts)).toBe(1)
    expect(await sessionCount(user.userId)).toBe(0)
  })

  test('OTP verify: five failures invalidate the challenge', async ({ page, context }) => {
    const code = '482917'
    const challengeId = await mintOtpChallenge(user.userId, code)
    await context.addCookies([
      { name: 'foundry_login_email', value: user.email, url: BASE, path: '/' },
      { name: 'foundry_otp_challenge', value: challengeId, url: BASE, path: '/' },
    ])
    await page.goto(`${BASE}/login/verify`)
    await page.waitForSelector('input[name="code"]', { timeout: 15_000 })

    for (let i = 0; i < 5; i++) {
      await submitCode(page, '000000')
      await page.waitForTimeout(300)
    }

    // challenge row should be deleted after 5 failures
    const rows = await wsDb()`SELECT id FROM email_otp_challenges WHERE id = ${challengeId}`
    expect(rows.length).toBe(0)
    expect(await sessionCount(user.userId)).toBe(0)
  })
})

test.describe('workspace — sessions and admin', () => {
  test('expired session is rejected', async ({ request }) => {
    const sess = await mintSession()
    await wsDb()`UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE id = ${sess}`
    const res = await request.get(`${BASE}/admin/users`, {
      headers: cookieHeader(sess),
      maxRedirects: 0,
    })
    expect([302, 307, 308]).toContain(res.status())
  })

  test('logout destroys the session server-side', async ({ request }) => {
    const sess = await mintSession()
    await request.get(`${BASE}/logout`, { headers: cookieHeader(sess), maxRedirects: 0 })
    const rows = await wsDb()`SELECT 1 FROM sessions WHERE id = ${sess}`
    expect(rows.length).toBe(0)
  })

  for (const path of ['/admin/users', '/admin/sessions', '/admin/audit']) {
    test(`admin page ${path} renders for an admin`, async ({ page, context }) => {
      const sess = await mintSession()
      await context.addCookies([{ name: 'foundry_session', value: sess, url: BASE }])
      const res = await page.goto(`${BASE}${path}`)
      expect(res!.status()).toBeLessThan(400)
      await expect(page.locator('body')).toContainText(/.+/)
    })
  }

  test('admin pages refuse non-admin users', async ({ request }) => {
    const sess = await mintSession(E2E_TOTP_EMAIL)
    const res = await request.get(`${BASE}/admin/users`, {
      headers: cookieHeader(sess),
      maxRedirects: 0,
    })
    expect([302, 303, 307, 308, 403, 404]).toContain(res.status())
  })

  test('users CSV export works and contains data', async ({ request }) => {
    const sess = await mintSession()
    const res = await request.get(`${BASE}/admin/users/export`, { headers: cookieHeader(sess) })
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('@')
  })
})
