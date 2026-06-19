import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import db from './db'

export const SESSION_COOKIE = 'foundry_session'
const SESSION_DAYS_DEFAULT = 30

export type Role = 'owner' | 'admin' | 'member'

export type SessionUser = {
  userId: string
  email: string
  name: string | null
  sessionId: string
  orgId: string | null
  role: Role | null
  totpEnforced: boolean
  hasTotpSecret: boolean
  mustResetPassword: boolean
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies()
  const sessionId = jar.get(SESSION_COOKIE)?.value
  if (!sessionId) return null

  const rows = await db`
    SELECT s.id as "sessionId", s.org_id as "orgId",
           u.id as "userId", u.email, u.name,
           m.role,
           COALESCE(o.require_totp, false) as "totpEnforced",
           (u.totp_secret IS NOT NULL) as "hasTotpSecret",
           COALESCE(u.must_reset_password, false) as "mustResetPassword"
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN org_members m ON m.org_id = s.org_id AND m.user_id = s.user_id
    LEFT JOIN orgs o ON o.id = s.org_id
    WHERE s.id = ${sessionId}
      AND s.expires_at > NOW()
      AND u.deactivated_at IS NULL
  `
  return (rows[0] as unknown as SessionUser) ?? null
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.mustResetPassword) redirect('/login/reset-password')
  return session
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'admin') redirect('/')
  return session
}

export async function createSession(
  userId: string,
  orgId: string | null,
  meta?: { ip?: string | null; ua?: string | null },
): Promise<{ sessionId: string; timeoutHours: number }> {
  let timeoutHours = SESSION_DAYS_DEFAULT * 24
  let maxSessions = 10

  if (orgId) {
    const orgRows = await db`
      SELECT session_timeout_hours, max_sessions FROM orgs WHERE id = ${orgId}
    `
    if (orgRows.length) {
      timeoutHours = orgRows[0].session_timeout_hours as number
      maxSessions = orgRows[0].max_sessions as number
    }
  }

  if (maxSessions > 0) {
    await db`
      DELETE FROM sessions
      WHERE user_id = ${userId} AND id IN (
        SELECT id FROM sessions
        WHERE user_id = ${userId} AND expires_at > NOW()
        ORDER BY created_at ASC
        LIMIT GREATEST(0, (
          SELECT COUNT(*) FROM sessions
          WHERE user_id = ${userId} AND expires_at > NOW()
        ) - ${maxSessions - 1})
      )
    `
  }

  const rows = await db`
    INSERT INTO sessions (user_id, org_id, expires_at, ip_address, user_agent)
    VALUES (
      ${userId},
      ${orgId},
      NOW() + (${timeoutHours} * INTERVAL '1 hour'),
      ${meta?.ip ?? null},
      ${meta?.ua ?? null}
    )
    RETURNING id
  `
  return { sessionId: rows[0].id as string, timeoutHours }
}

export async function destroySession(sessionId: string) {
  await db`DELETE FROM sessions WHERE id = ${sessionId}`
}

export async function setSessionCookie(sessionId: string, timeoutHours: number = SESSION_DAYS_DEFAULT * 24) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: timeoutHours * 60 * 60,
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}
