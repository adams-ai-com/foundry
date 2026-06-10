import { test, expect } from '@playwright/test'
import {
  E2E_TOTP_EMAIL,
  authenticator,
  cookieHeader,
  ensureTotpTestUser,
  mintSession,
  resetTotpLock,
  totpLockState,
  wsDb,
} from '@foundry/e2e'

const BASE = 'http://127.0.0.1:3000'

/** Email step — sets the foundry_login_email cookie and lands on the password page. */
async function submitEmailStep(page: import('@playwright/test').Page, email: string) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[name="email"]', email)
  await page.click('button[type="submit"]')
  await page.waitForSelector('input[name="password"]', { timeout: 15_000 })
}

/** The TOTP verify page is reachable directly once the email cookie is set. */
async function gotoVerifyStep(page: import('@playwright/test').Page, email: string) {
  await submitEmailStep(page, email)
  await page.goto(`${BASE}/login/verify`)
  await page.waitForSelector('input[name="code"]', { timeout: 15_000 })
}

async function submitCode(page: import('@playwright/test').Page, code: string) {
  await page.fill('input[name="code"]', code)
  await page.click('button[type="submit"]')
}

async function sessionCount(userId: string) {
  const rows = await wsDb()`SELECT id FROM sessions WHERE user_id = ${userId}`
  return rows.length
}

test.describe.serial('workspace — login flows', () => {
  let user: { userId: string; email: string; secret: string; password: string }

  test.beforeAll(async () => {
    user = await ensureTotpTestUser()
  })

  test.afterEach(async () => {
    await resetTotpLock(user.userId)
    await wsDb()`DELETE FROM sessions WHERE user_id = ${user.userId}`
  })

  test('password login establishes a session', async ({ page }) => {
    // NOTE (observed 2026-06-10): password login does NOT challenge for TOTP
    // even when the user has a TOTP secret configured. Flagged to operator as
    // a security posture question; this test pins current behavior.
    await submitEmailStep(page, user.email)
    await page.fill('input[name="password"]', user.password)
    await page.click('button[type="submit"]')

    await expect
      .poll(() => sessionCount(user.userId), { timeout: 15_000 })
      .toBeGreaterThan(0)
  })

  test('wrong password does not create a session', async ({ page }) => {
    await submitEmailStep(page, user.email)
    await page.fill('input[name="password"]', 'definitely-wrong-password')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    expect(await sessionCount(user.userId)).toBe(0)
  })

  test('TOTP verify: valid code establishes a session', async ({ page }) => {
    await gotoVerifyStep(page, user.email)
    await submitCode(page, authenticator.generate(user.secret))

    await expect
      .poll(() => sessionCount(user.userId), { timeout: 15_000 })
      .toBeGreaterThan(0)
  })

  test('TOTP verify: wrong code is rejected and counted', async ({ page }) => {
    await gotoVerifyStep(page, user.email)
    const valid = authenticator.generate(user.secret)
    const wrong = valid === '999999' ? '000000' : '999999'
    await submitCode(page, wrong)

    await expect(page.getByText(/invalid|attempts remaining|try again/i).first()).toBeVisible({
      timeout: 10_000,
    })
    const state = await totpLockState(user.userId)
    expect(Number(state.totp_failed_count)).toBeGreaterThan(0)
    expect(await sessionCount(user.userId)).toBe(0)
  })

  test('TOTP verify: five failures lock the account', async ({ page }) => {
    await gotoVerifyStep(page, user.email)
    const valid = authenticator.generate(user.secret)
    const wrong = valid === '999999' ? '000000' : '999999'

    for (let i = 0; i < 5; i++) {
      await submitCode(page, wrong)
      await page.waitForTimeout(300)
    }

    const state = await totpLockState(user.userId)
    expect(state.totp_locked_until).not.toBeNull()

    // a VALID code must now be refused too
    await submitCode(page, authenticator.generate(user.secret))
    await page.waitForTimeout(1000)
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
