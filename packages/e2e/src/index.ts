// Shared e2e helpers for all Foundry app test suites.
// Pattern established by apps/pdf/e2e (2026-06-10): direct-DB session minting,
// [E2E]-prefixed artifacts, mocks for anything that would leave the box.
import { readFileSync } from 'fs'
import { randomBytes, randomUUID, createHash } from 'crypto'
import postgres from 'postgres'

export const E2E_PREFIX = '[E2E]'
export const E2E_USER_AGENT = 'foundry-e2e'
export const E2E_TEST_EMAIL = 'e2e-auth@test.local'
export const E2E_TEST_PASSWORD = 'E2E-login-flow-test-7491'

/** @deprecated use E2E_TEST_EMAIL */
export const E2E_TOTP_EMAIL = E2E_TEST_EMAIL

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

/** Read a single key out of a .env file without touching process.env. */
export function envFileValue(path: string, key: string): string | undefined {
  try {
    const raw = readFileSync(path, 'utf8')
    const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return m?.[1]
  } catch {
    return undefined
  }
}

const _dbs = new Map<string, ReturnType<typeof postgres>>()

/** Postgres connection from a connection string (cached, max 2). */
export function dbFromUrl(url: string) {
  let db = _dbs.get(url)
  if (!db) {
    db = postgres(url, { max: 2 })
    _dbs.set(url, db)
  }
  return db
}

/** Postgres connection from a key in an app's .env file. */
export function dbFromEnvFile(envPath: string, key = 'DATABASE_URL') {
  const url = envFileValue(envPath, key)
  if (!url) throw new Error(`${key} not found in ${envPath}`)
  return dbFromUrl(url)
}

/** Workspace DB (auth: users, orgs, sessions). */
export function wsDb() {
  const url = process.env.WORKSPACE_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('WORKSPACE_DATABASE_URL / DATABASE_URL not set')
  return dbFromUrl(url)
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

/** Same shape as workspace admin-actions: pbkdf2:100000:<salt>:<sha512-base64> */
async function mintPasswordHash(password: string): Promise<string> {
  const { pbkdf2Sync } = await import('crypto')
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('base64')
  return `pbkdf2:100000:${salt}:${hash}`
}

/**
 * Dedicated login-test user with a password. Idempotent.
 * Never use a real account for lockout/failure tests.
 */
export async function ensureTestUser(): Promise<{ userId: string; email: string; password: string }> {
  const sql = wsDb()
  const passwordHash = await mintPasswordHash(E2E_TEST_PASSWORD)
  const [existing] = await sql`SELECT id, password_hash FROM users WHERE email = ${E2E_TEST_EMAIL}`
  if (existing) {
    if (!existing.password_hash) {
      await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${existing.id}`
    }
    return { userId: existing.id, email: E2E_TEST_EMAIL, password: E2E_TEST_PASSWORD }
  }
  const id = randomUUID()
  await sql`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (${id}, ${E2E_TEST_EMAIL}, ${'E2E Auth Tester'}, ${passwordHash})`
  const { orgId } = await testUser()
  if (orgId) {
    await sql`
      INSERT INTO org_members (user_id, org_id, role)
      VALUES (${id}, ${orgId}, 'member')
      ON CONFLICT DO NOTHING`
  }
  return { userId: id, email: E2E_TEST_EMAIL, password: E2E_TEST_PASSWORD }
}

/** @deprecated use ensureTestUser */
export const ensureTotpTestUser = ensureTestUser

export const E2E_PW_EMAIL = 'e2e-pwonly@test.local'

export async function ensurePasswordOnlyTestUser(): Promise<{ userId: string; email: string; password: string }> {
  const sql = wsDb()
  const [existing] = await sql`SELECT id FROM users WHERE email = ${E2E_PW_EMAIL}`
  if (existing) return { userId: existing.id, email: E2E_PW_EMAIL, password: E2E_TEST_PASSWORD }
  const id = randomUUID()
  const passwordHash = await mintPasswordHash(E2E_TEST_PASSWORD)
  await sql`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (${id}, ${E2E_PW_EMAIL}, ${'E2E Password Tester'}, ${passwordHash})`
  const { orgId } = await testUser()
  if (orgId) {
    await sql`
      INSERT INTO org_members (user_id, org_id, role)
      VALUES (${id}, ${orgId}, 'member')
      ON CONFLICT DO NOTHING`
  }
  return { userId: id, email: E2E_PW_EMAIL, password: E2E_TEST_PASSWORD }
}

/**
 * Insert a known OTP challenge into the DB so tests can submit a predetermined code
 * without needing real email delivery. Returns the challenge ID for the cookie.
 */
export async function mintOtpChallenge(userId: string, code: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const codeHash = createHash('sha256').update(code + salt).digest('hex')
  const id = randomUUID()
  await wsDb()`
    INSERT INTO email_otp_challenges (id, user_id, code_hash, salt, expires_at)
    VALUES (${id}, ${userId}, ${codeHash}, ${salt}, now() + interval '10 minutes')`
  return id
}

export async function cleanupOtpChallenges(userId: string) {
  await wsDb()`DELETE FROM email_otp_challenges WHERE user_id = ${userId}`
}

/** Remove sessions this helper minted (any user). Call in global teardown. */
export async function cleanupSessions() {
  await wsDb()`DELETE FROM sessions WHERE user_agent = ${E2E_USER_AGENT}`
  await wsDb()`
    DELETE FROM sessions WHERE user_id IN
      (SELECT id FROM users WHERE email IN (${E2E_TOTP_EMAIL}, ${E2E_PW_EMAIL}))`
}

export async function closeDb() {
  for (const db of _dbs.values()) await db.end()
  _dbs.clear()
}
