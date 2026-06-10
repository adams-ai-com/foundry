// Shared e2e helpers for all Foundry app test suites.
// Pattern established by apps/pdf/e2e (2026-06-10): direct-DB session minting,
// [E2E]-prefixed artifacts, mocks for anything that would leave the box.
import { readFileSync } from 'fs'
import { randomBytes } from 'crypto'
import postgres from 'postgres'

export const E2E_PREFIX = '[E2E]'
export const E2E_USER_AGENT = 'foundry-e2e'

/** Load KEY=VALUE pairs from a .env file into process.env (existing env wins). */
export function loadEnvFile(path: string) {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
}

let _ws: ReturnType<typeof postgres> | null = null

/** Workspace DB (auth: users, orgs, sessions). */
export function wsDb() {
  if (!_ws) {
    const url = process.env.WORKSPACE_DATABASE_URL ?? process.env.DATABASE_URL
    if (!url) throw new Error('WORKSPACE_DATABASE_URL / DATABASE_URL not set')
    _ws = postgres(url, { max: 2 })
  }
  return _ws
}

export async function testUser(email = 'john@adams-ai.com') {
  const sql = wsDb()
  const [u] = await sql`SELECT id, email, name FROM users WHERE email = ${email}`
  if (!u) throw new Error(`test user ${email} not found`)
  const [m] = await sql`SELECT org_id FROM org_members WHERE user_id = ${u.id} LIMIT 1`
  return { userId: u.id as string, orgId: (m?.org_id ?? null) as string | null, email: u.email as string }
}

/** Mint a real session row; cookie name is foundry_session across all apps. */
export async function mintSession(email?: string): Promise<string> {
  const { userId, orgId } = await testUser(email)
  const id = randomBytes(24).toString('hex')
  await wsDb()`
    INSERT INTO sessions (id, user_id, org_id, expires_at, user_agent)
    VALUES (${id}, ${userId}, ${orgId}, now() + interval '1 hour', ${E2E_USER_AGENT})`
  return id
}

export function cookieHeader(sessionId: string) {
  return { cookie: `foundry_session=${sessionId}` }
}

/** Remove every session this helper ever minted. Call in global teardown. */
export async function cleanupSessions() {
  await wsDb()`DELETE FROM sessions WHERE user_agent = ${E2E_USER_AGENT}`
}

export async function closeDb() {
  if (_ws) await _ws.end()
  _ws = null
}
