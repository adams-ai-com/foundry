import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import postgres from 'postgres'

export const SESSION_COOKIE = 'foundry_session'
export const SESSION_DAYS = 30

export type SessionUser = {
  userId: string
  email: string
  name: string | null
  sessionId: string
  orgId: string | null
  orgSlug: string | null
}

let _db: ReturnType<typeof postgres> | null = null

function getAuthDb() {
  if (!_db) {
    const url = process.env.WORKSPACE_DATABASE_URL || process.env.DATABASE_URL
    if (!url) throw new Error('No database URL configured for @foundry/auth')
    _db = postgres(url, { max: 3 })
  }
  return _db
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies()
  const sessionId = jar.get(SESSION_COOKIE)?.value
  if (!sessionId) return null

  const db = getAuthDb()
  const rows = await db`
    SELECT s.id as "sessionId", s.org_id as "orgId",
           o.slug as "orgSlug",
           u.id as "userId", u.email, u.name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN orgs o ON o.id = s.org_id
    WHERE s.id = ${sessionId}
      AND s.expires_at > NOW()
  `
  return (rows[0] as SessionUser) ?? null
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    // Absolute URL bypasses basePath — sub-apps set FOUNDRY_WORKSPACE_URL
    const base = process.env.FOUNDRY_WORKSPACE_URL ?? ''
    redirect(`${base}/login`)
  }
  return session
}

export async function destroySession(sessionId: string): Promise<void> {
  const db = getAuthDb()
  await db`DELETE FROM sessions WHERE id = ${sessionId}`
}
