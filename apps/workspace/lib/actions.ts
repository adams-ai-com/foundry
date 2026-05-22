'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import db from './db'
import { createSession, setSessionCookie, destroySession, clearSessionCookie, getSession } from './auth'
import { generateSecret, verifyCode } from './totp'

const ALLOWLIST = new Set(['john@adams-ai.com'])
const EMAIL_COOKIE = 'foundry_login_email'
const PENDING_SECRET_COOKIE = 'foundry_totp_pending'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export async function submitEmail(formData: FormData) {
  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Valid email required' }
  if (!ALLOWLIST.has(email)) return { error: 'Access denied' }

  const jar = await cookies()
  jar.set(EMAIL_COOKIE, email, { ...COOKIE_OPTS, maxAge: 10 * 60 })
  redirect('/login/verify')
}

export async function verifyTotp(formData: FormData) {
  const jar = await cookies()
  const email = jar.get(EMAIL_COOKIE)?.value
  if (!email) redirect('/login')

  const code = (formData.get('code') as string ?? '').replace(/\s/g, '')
  if (!code || code.length !== 6) return { error: 'Enter the 6-digit code' }

  const rows = await db`SELECT id, totp_secret FROM users WHERE email = ${email}`
  if (!rows.length || !rows[0].totp_secret) redirect('/login/setup')

  const user = rows[0]
  if (!verifyCode(user.totp_secret as string, code)) return { error: 'Invalid code — try again' }

  jar.delete(EMAIL_COOKIE)

  const memberRows = await db`
    SELECT org_id FROM org_members WHERE user_id = ${user.id} ORDER BY joined_at ASC LIMIT 1
  `
  const orgId = (memberRows[0]?.org_id ?? null) as string | null
  const sessionId = await createSession(user.id as string, orgId)
  await setSessionCookie(sessionId)
  redirect('/')
}

export async function startSetup(_formData: FormData) {
  const jar = await cookies()
  const email = jar.get(EMAIL_COOKIE)?.value
  if (!email) redirect('/login')

  const secret = generateSecret()
  jar.set(PENDING_SECRET_COOKIE, secret, { ...COOKIE_OPTS, maxAge: 10 * 60 })
  redirect('/login/setup')
}

export async function confirmTotpSetup(formData: FormData) {
  const jar = await cookies()
  const email = jar.get(EMAIL_COOKIE)?.value
  const secret = jar.get(PENDING_SECRET_COOKIE)?.value
  if (!email || !secret) redirect('/login')

  const code = (formData.get('code') as string ?? '').replace(/\s/g, '')
  if (!code || code.length !== 6) return { error: 'Enter the 6-digit code' }
  if (!verifyCode(secret, code)) return { error: 'Code did not match — scan the QR code and retry' }

  const userRows = await db`
    INSERT INTO users (email, totp_secret) VALUES (${email}, ${secret})
    ON CONFLICT (email) DO UPDATE SET totp_secret = ${secret}
    RETURNING id
  `
  const userId = userRows[0].id as string
  jar.delete(EMAIL_COOKIE)
  jar.delete(PENDING_SECRET_COOKIE)

  const memberRows = await db`
    SELECT org_id FROM org_members WHERE user_id = ${userId} ORDER BY joined_at ASC LIMIT 1
  `
  const orgId = (memberRows[0]?.org_id ?? null) as string | null
  const sessionId = await createSession(userId, orgId)
  await setSessionCookie(sessionId)
  redirect('/')
}

export async function createOrg(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const name = (formData.get('name') as string ?? '').trim()
  if (!name) return { error: 'Name required' }

  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!baseSlug) return { error: 'Invalid name' }

  const existing = await db`SELECT slug FROM orgs WHERE slug LIKE ${baseSlug + '%'}`
  const taken = new Set(existing.map(r => r.slug as string))
  let slug = baseSlug
  let n = 2
  while (taken.has(slug)) slug = `${baseSlug}-${n++}`

  const orgRows = await db`
    INSERT INTO orgs (name, slug) VALUES (${name}, ${slug}) RETURNING id, slug
  `
  const org = orgRows[0]

  await db`INSERT INTO org_members (org_id, user_id, role) VALUES (${org.id}, ${session.userId}, 'owner')`
  await db`UPDATE sessions SET org_id = ${org.id} WHERE id = ${session.sessionId}`

  redirect(`/org/${org.slug}`)
}

export async function logout() {
  const session = await getSession()
  if (session) await destroySession(session.sessionId)
  await clearSessionCookie()
  redirect('/login')
}
