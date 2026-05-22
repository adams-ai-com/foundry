import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

const SESSION_COOKIE = 'foundry_session'
const TEST_USER_EMAIL = 'test@playwright.local'
const TEST_SESSION_ID = 'playwright-test-session-sheets-000000001'

export default async function globalSetup() {
  dotenv.config({ path: path.join(__dirname, '../.env') })

  const sheetsDb = postgres(process.env.DATABASE_URL!)
  await sheetsDb`DELETE FROM spreadsheets`
  await sheetsDb.end()

  const wsDb = postgres(process.env.WORKSPACE_DATABASE_URL!)

  const users = await wsDb`
    INSERT INTO users (email, name) VALUES (${TEST_USER_EMAIL}, 'Playwright Test')
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `
  const userId = users[0].id

  await wsDb`DELETE FROM sessions WHERE id = ${TEST_SESSION_ID}`
  await wsDb`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${TEST_SESSION_ID}, ${userId}, NOW() + INTERVAL '30 days')
  `
  await wsDb.end()

  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  fs.writeFileSync(
    path.join(authDir, 'user.json'),
    JSON.stringify({
      cookies: [{
        name: SESSION_COOKIE,
        value: TEST_SESSION_ID,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      }],
      origins: [],
    }, null, 2),
  )
}
