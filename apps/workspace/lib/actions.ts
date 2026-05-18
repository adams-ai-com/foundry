'use server'

import { redirect } from 'next/navigation'
import db from './db'
import { createSession, setSessionCookie, destroySession, clearSessionCookie, getSession } from './auth'
import { sendMagicLink } from './mailer'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function requestMagicLink(formData: FormData) {
  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Valid email required' }

  const slug = formData.get('redirect_slug') as string | null

  // Create or expire existing tokens for this email, then insert new one
  await db`UPDATE magic_tokens SET used_at = NOW() WHERE email = ${email} AND used_at IS NULL`
  const rows = await db`
    INSERT INTO magic_tokens (email, redirect_slug)
    VALUES (${email}, ${slug ?? null})
    RETURNING token
  `
  const token = rows[0].token as string
  const url = `${APP_URL}/login/verify?token=${token}`
  await sendMagicLink(email, url)
  return { ok: true }
}

export async function verifyMagicLink(token: string): Promise<{ error: string } | null> {
  const rows = await db`
    SELECT id, email, redirect_slug, expires_at, used_at
    FROM magic_tokens
    WHERE token = ${token}
  `
  if (!rows.length) return { error: 'Invalid link' }
  const row = rows[0]
  if (row.used_at) return { error: 'Link already used' }
  if (new Date(row.expires_at as string) < new Date()) return { error: 'Link expired' }

  await db`UPDATE magic_tokens SET used_at = NOW() WHERE id = ${row.id}`

  // Upsert user
  const userRows = await db`
    INSERT INTO users (email) VALUES (${row.email})
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id
  `
  const userId = userRows[0].id as string

  // Find the user's default org (most recently joined)
  const memberRows = await db`
    SELECT org_id FROM org_members
    WHERE user_id = ${userId}
    ORDER BY joined_at DESC LIMIT 1
  `
  const orgId = (row.redirect_slug
    ? await db`SELECT id FROM orgs WHERE slug = ${row.redirect_slug}`.then(r => r[0]?.id ?? null)
    : memberRows[0]?.org_id ?? null) as string | null

  const sessionId = await createSession(userId, orgId)
  await setSessionCookie(sessionId)
  return null
}

export async function createOrg(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const name = (formData.get('name') as string ?? '').trim()
  if (!name) return { error: 'Name required' }

  // Derive slug from name
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!baseSlug) return { error: 'Invalid name' }

  // Make slug unique
  const existing = await db`SELECT slug FROM orgs WHERE slug LIKE ${baseSlug + '%'}`
  const taken = new Set(existing.map(r => r.slug as string))
  let slug = baseSlug
  let n = 2
  while (taken.has(slug)) slug = `${baseSlug}-${n++}`

  const orgRows = await db`
    INSERT INTO orgs (name, slug) VALUES (${name}, ${slug}) RETURNING id, slug
  `
  const org = orgRows[0]

  await db`
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (${org.id}, ${session.userId}, 'owner')
  `

  // Update session to point to new org
  await db`UPDATE sessions SET org_id = ${org.id} WHERE id = ${session.sessionId}`

  redirect(`/org/${org.slug}`)
}

export async function logout() {
  const session = await getSession()
  if (session) await destroySession(session.sessionId)
  await clearSessionCookie()
  redirect('/login')
}
