import { cookies } from 'next/headers'
import db from './db'

export const SESSION_COOKIE = 'foundry_session'
const SESSION_DAYS = 30

export type SessionUser = {
  userId: string
  email: string
  name: string | null
  sessionId: string
  orgId: string | null
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies()
  const sessionId = jar.get(SESSION_COOKIE)?.value
  if (!sessionId) return null

  const rows = await db`
    SELECT s.id as "sessionId", s.org_id as "orgId",
           u.id as "userId", u.email, u.name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sessionId}
      AND s.expires_at > NOW()
  `
  return (rows[0] as SessionUser) ?? null
}

export async function createSession(userId: string, orgId: string | null): Promise<string> {
  const rows = await db`
    INSERT INTO sessions (user_id, org_id, expires_at)
    VALUES (${userId}, ${orgId}, NOW() + INTERVAL '${db.unsafe(String(SESSION_DAYS))} days')
    RETURNING id
  `
  return rows[0].id as string
}

export async function destroySession(sessionId: string) {
  await db`DELETE FROM sessions WHERE id = ${sessionId}`
}

export async function setSessionCookie(sessionId: string) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}
